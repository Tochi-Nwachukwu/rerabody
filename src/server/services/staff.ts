import type { PrismaClient } from "@/generated/prisma/client";
import { UserError } from "@/server/errors";
import { OWNER_ROLE_NAME, type Permission, isPermission } from "@/server/permissions";
import { generateToken, hashToken, tokenMatchesHash } from "@/server/tokens";

import { audit } from "./audit";
import type { StaffContext } from "./staff-access";

const INVITE_DAYS = 7;

async function isOwnerRole(prisma: PrismaClient, roleId: string | null | undefined) {
  if (!roleId) return false;
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { name: true, isSystem: true },
  });
  return !!role && role.isSystem && role.name === OWNER_ROLE_NAME;
}

/** Creates an invite and returns the raw token for the email link. Only owners can invite owners. */
export async function inviteStaff(
  prisma: PrismaClient,
  input: { email: string; roleId: string; actor: StaffContext },
) {
  const email = input.email.trim().toLowerCase();
  const role = await prisma.role.findUnique({ where: { id: input.roleId } });
  if (!role) throw new UserError("Choose a role.");
  if ((await isOwnerRole(prisma, role.id)) && !input.actor.isOwner)
    throw new UserError("Only an owner can invite another owner.");
  const existing = await prisma.user.findUnique({ where: { email }, select: { roleId: true } });
  if (existing?.roleId) throw new UserError("This person is already on the team.");
  await prisma.staffInvite.updateMany({
    where: { email, acceptedAt: null },
    data: { expiresAt: new Date() },
  });
  const token = generateToken();
  const invite = await prisma.staffInvite.create({
    data: {
      email,
      roleId: role.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + INVITE_DAYS * 86400_000),
    },
  });
  await audit(prisma, {
    actorId: input.actor.userId,
    action: "staff.invite",
    targetType: "StaffInvite",
    targetId: invite.id,
    after: { email, role: role.name },
  });
  return { invite, token, roleName: role.name };
}

export async function findValidInvite(prisma: PrismaClient, inviteId: string, token: string) {
  const invite = await prisma.staffInvite.findUnique({
    where: { id: inviteId },
    include: { role: { select: { name: true } } },
  });
  if (
    !invite ||
    invite.acceptedAt ||
    invite.expiresAt < new Date() ||
    !tokenMatchesHash(token, invite.tokenHash)
  )
    return null;
  return invite;
}

/**
 * A2: accepts an invite. A new person gets an account (email verified by the
 * link); an existing customer account is promoted. Returns the user id.
 */
export async function acceptInvite(
  prisma: PrismaClient,
  input: { inviteId: string; token: string; name: string; passwordHash: string | null },
) {
  const invite = await findValidInvite(prisma, input.inviteId, input.token);
  if (!invite)
    throw new UserError("This invitation has expired or was already used. Ask for a new one.");
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.staffInvite.updateMany({
      where: { id: invite.id, acceptedAt: null },
      data: { acceptedAt: new Date() },
    });
    if (claimed.count === 0) throw new UserError("This invitation was already used.");
    const existing = await tx.user.findUnique({ where: { email: invite.email } });
    if (existing) {
      if (existing.roleId) throw new UserError("This account is already on the team.");
      await tx.user.update({
        where: { id: existing.id },
        data: { roleId: invite.roleId, status: "ACTIVE", emailVerified: true },
      });
      await audit(tx, {
        actorId: existing.id,
        action: "staff.accept",
        targetType: "User",
        targetId: existing.id,
        after: { roleId: invite.roleId },
      });
      return { userId: existing.id, created: false };
    }
    if (!input.passwordHash) throw new UserError("Choose a password.");
    const user = await tx.user.create({
      data: {
        email: invite.email,
        name: input.name,
        emailVerified: true,
        roleId: invite.roleId,
        status: "ACTIVE",
      },
    });
    await tx.account.create({
      data: {
        userId: user.id,
        providerId: "credential",
        accountId: user.id,
        password: input.passwordHash,
      },
    });
    await audit(tx, {
      actorId: user.id,
      action: "staff.accept",
      targetType: "User",
      targetId: user.id,
      after: { roleId: invite.roleId },
    });
    return { userId: user.id, created: true };
  });
}

/** Rule 14 guard: the Owner role cannot be taken from an owner by someone else, nor from the last owner. */
async function assertCanChangeOwner(
  prisma: PrismaClient,
  target: { id: string; roleId: string | null },
  actor: StaffContext,
) {
  if (!(await isOwnerRole(prisma, target.roleId))) return;
  if (actor.userId !== target.id)
    throw new UserError("An owner's role and access can only be changed by that owner.");
  const owners = await prisma.user.count({ where: { roleId: target.roleId!, status: "ACTIVE" } });
  if (owners <= 1)
    throw new UserError(
      "You are the only owner. Invite another owner before changing your own access.",
    );
}

export async function changeStaffRole(
  prisma: PrismaClient,
  input: { userId: string; roleId: string; actor: StaffContext },
) {
  const target = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!target?.roleId) throw new UserError("This person is not on the team.");
  await assertCanChangeOwner(prisma, target, input.actor);
  if ((await isOwnerRole(prisma, input.roleId)) && !input.actor.isOwner)
    throw new UserError("Only an owner can make someone an owner.");
  await prisma.user.update({ where: { id: target.id }, data: { roleId: input.roleId } });
  await audit(prisma, {
    actorId: input.actor.userId,
    action: "staff.role",
    targetType: "User",
    targetId: target.id,
    before: { roleId: target.roleId },
    after: { roleId: input.roleId },
  });
}

export async function setStaffActive(
  prisma: PrismaClient,
  input: { userId: string; active: boolean; actor: StaffContext },
) {
  const target = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!target?.roleId) throw new UserError("This person is not on the team.");
  if (target.id === input.actor.userId && !input.active)
    throw new UserError("You cannot deactivate yourself.");
  await assertCanChangeOwner(prisma, target, input.actor);
  await prisma.user.update({
    where: { id: target.id },
    data: { status: input.active ? "ACTIVE" : "DEACTIVATED" },
  });
  if (!input.active) await prisma.session.deleteMany({ where: { userId: target.id } });
  await audit(prisma, {
    actorId: input.actor.userId,
    action: input.active ? "staff.reactivate" : "staff.deactivate",
    targetType: "User",
    targetId: target.id,
  });
}

/** Removes staff access but keeps the account as a customer. */
export async function removeStaff(
  prisma: PrismaClient,
  input: { userId: string; actor: StaffContext },
) {
  const target = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!target?.roleId) throw new UserError("This person is not on the team.");
  if (target.id === input.actor.userId) throw new UserError("You cannot remove yourself.");
  await assertCanChangeOwner(prisma, target, input.actor);
  await prisma.user.update({ where: { id: target.id }, data: { roleId: null } });
  await prisma.session.deleteMany({ where: { userId: target.id } });
  await audit(prisma, {
    actorId: input.actor.userId,
    action: "staff.remove",
    targetType: "User",
    targetId: target.id,
    before: { roleId: target.roleId },
  });
}

export async function revokeInvite(
  prisma: PrismaClient,
  input: { inviteId: string; actorId: string },
) {
  await prisma.staffInvite.update({
    where: { id: input.inviteId },
    data: { expiresAt: new Date() },
  });
  await audit(prisma, {
    actorId: input.actorId,
    action: "staff.invite.revoke",
    targetType: "StaffInvite",
    targetId: input.inviteId,
  });
}

// Roles (A26) ------------------------------------------------------------------

async function assertEditableRole(prisma: PrismaClient, roleId: string) {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw new UserError("This role no longer exists.");
  if (role.isSystem) throw new UserError("The Owner role cannot be edited or deleted.");
  return role;
}

export async function saveRole(
  prisma: PrismaClient,
  input: { id?: string; name: string; permissions: string[]; actorId: string },
) {
  const permissions = [...new Set(input.permissions)].filter(isPermission) as Permission[];
  if (input.name.trim().toLowerCase() === OWNER_ROLE_NAME.toLowerCase())
    throw new UserError("That name is reserved.");
  const before = input.id ? await assertEditableRole(prisma, input.id) : null;
  try {
    return await prisma.$transaction(async (tx) => {
      const role = before
        ? await tx.role.update({ where: { id: before.id }, data: { name: input.name.trim() } })
        : await tx.role.create({ data: { name: input.name.trim() } });
      await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
      if (permissions.length)
        await tx.rolePermission.createMany({
          data: permissions.map((permission) => ({ roleId: role.id, permission })),
        });
      await audit(tx, {
        actorId: input.actorId,
        action: before ? "role.update" : "role.create",
        targetType: "Role",
        targetId: role.id,
        before,
        after: { name: role.name, permissions },
      });
      return role;
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002")
      throw new UserError("Another role already has that name.");
    throw error;
  }
}

export async function deleteRole(prisma: PrismaClient, input: { id: string; actorId: string }) {
  const role = await assertEditableRole(prisma, input.id);
  const users = await prisma.user.count({ where: { roleId: role.id } });
  if (users > 0)
    throw new UserError(`Move the ${users} team member(s) with this role to another role first.`);
  await prisma.staffInvite.deleteMany({ where: { roleId: role.id } });
  await prisma.role.delete({ where: { id: role.id } });
  await audit(prisma, {
    actorId: input.actorId,
    action: "role.delete",
    targetType: "Role",
    targetId: role.id,
    before: role,
  });
}
