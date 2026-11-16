import { beforeEach, describe, expect, it } from "vitest";

import { loadStaffContext } from "@/server/services/staff-access";
import {
  acceptInvite,
  changeStaffRole,
  deleteRole,
  findValidInvite,
  inviteStaff,
  removeStaff,
  saveRole,
  setStaffActive,
} from "@/server/services/staff";

import { resetDb, testDb } from "../helpers/db";
import { createRole, createUser } from "../helpers/factories";

describe("staff and roles", () => {
  let owner: Awaited<ReturnType<typeof createUser>>;
  let manager: Awaited<ReturnType<typeof createUser>>;
  let ownerRole: Awaited<ReturnType<typeof createRole>>;
  let fulfilRole: Awaited<ReturnType<typeof createRole>>;
  const ctx = async (id: string) => (await loadStaffContext(testDb, id))!;

  beforeEach(async () => {
    await resetDb();
    ownerRole = await createRole("Owner");
    const managerRole = await createRole("Manager", ["staff.manage", "roles.manage"]);
    fulfilRole = await createRole("Fulfilment staff");
    owner = await createUser({ roleId: ownerRole.id, name: "Owner" });
    manager = await createUser({ roleId: managerRole.id, name: "Manager" });
  });

  it("invites and accepts: a new person gets a verified staff account", async () => {
    const { invite, token } = await inviteStaff(testDb, {
      email: "New@Example.test",
      roleId: fulfilRole.id,
      actor: await ctx(owner.id),
    });
    expect(invite.tokenHash).not.toBe(token);
    expect(await findValidInvite(testDb, invite.id, "wrong-token")).toBeNull();
    const res = await acceptInvite(testDb, {
      inviteId: invite.id,
      token,
      name: "New Person",
      passwordHash: "hash",
    });
    expect(res.created).toBe(true);
    const user = await testDb.user.findUniqueOrThrow({
      where: { email: "new@example.test" },
      include: { accounts: true },
    });
    expect(user).toMatchObject({ roleId: fulfilRole.id, emailVerified: true, status: "ACTIVE" });
    expect(user.accounts[0]).toMatchObject({ providerId: "credential", accountId: user.id });
    await expect(
      acceptInvite(testDb, { inviteId: invite.id, token, name: "Again", passwordHash: "hash" }),
    ).rejects.toThrow(/expired or was already used/);
  });

  it("promotes an existing customer account and refuses expired invites", async () => {
    const customer = await createUser({ email: "shopper@example.test" });
    const { invite, token } = await inviteStaff(testDb, {
      email: "shopper@example.test",
      roleId: fulfilRole.id,
      actor: await ctx(owner.id),
    });
    expect(
      (await acceptInvite(testDb, { inviteId: invite.id, token, name: "x", passwordHash: null }))
        .created,
    ).toBe(false);
    expect((await testDb.user.findUniqueOrThrow({ where: { id: customer.id } })).roleId).toBe(
      fulfilRole.id,
    );

    const second = await inviteStaff(testDb, {
      email: "late@example.test",
      roleId: fulfilRole.id,
      actor: await ctx(owner.id),
    });
    await testDb.staffInvite.update({
      where: { id: second.invite.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(
      acceptInvite(testDb, {
        inviteId: second.invite.id,
        token: second.token,
        name: "x",
        passwordHash: "h",
      }),
    ).rejects.toThrow(/expired/);
  });

  it("rule 14: nobody else can change, deactivate or remove the owner", async () => {
    const m = await ctx(manager.id);
    await expect(
      changeStaffRole(testDb, { userId: owner.id, roleId: fulfilRole.id, actor: m }),
    ).rejects.toThrow(/only be changed by that owner/);
    await expect(
      setStaffActive(testDb, { userId: owner.id, active: false, actor: m }),
    ).rejects.toThrow(/only be changed by that owner/);
    await expect(removeStaff(testDb, { userId: owner.id, actor: m })).rejects.toThrow(
      /only be changed by that owner/,
    );
    // The sole owner cannot demote themselves either.
    await expect(
      changeStaffRole(testDb, {
        userId: owner.id,
        roleId: fulfilRole.id,
        actor: await ctx(owner.id),
      }),
    ).rejects.toThrow(/only owner/);
    expect((await testDb.user.findUniqueOrThrow({ where: { id: owner.id } })).roleId).toBe(
      ownerRole.id,
    );
  });

  it("rule 14: the Owner role cannot be edited or deleted, and only owners create owners", async () => {
    await expect(
      saveRole(testDb, { id: ownerRole.id, name: "Boss", permissions: [], actorId: owner.id }),
    ).rejects.toThrow(/cannot be edited/);
    await expect(deleteRole(testDb, { id: ownerRole.id, actorId: owner.id })).rejects.toThrow(
      /cannot be edited or deleted/,
    );
    await expect(
      inviteStaff(testDb, {
        email: "x@example.test",
        roleId: ownerRole.id,
        actor: await ctx(manager.id),
      }),
    ).rejects.toThrow(/Only an owner/);
    await expect(
      saveRole(testDb, { name: "owner", permissions: [], actorId: owner.id }),
    ).rejects.toThrow(/reserved/);
  });

  it("edits role permissions and refuses deleting a role in use", async () => {
    const role = await saveRole(testDb, {
      name: "Packers",
      permissions: ["orders.read", "orders.update", "not.real"],
      actorId: owner.id,
    });
    expect(
      (await testDb.rolePermission.findMany({ where: { roleId: role.id } }))
        .map((p) => p.permission)
        .sort(),
    ).toEqual(["orders.read", "orders.update"]);
    await createUser({ roleId: role.id });
    await expect(deleteRole(testDb, { id: role.id, actorId: owner.id })).rejects.toThrow(
      /Move the 1/,
    );
  });

  it("deactivating staff ends their sessions and access", async () => {
    const staffer = await createUser({ roleId: fulfilRole.id });
    await testDb.session.create({
      data: { userId: staffer.id, token: "tok", expiresAt: new Date(Date.now() + 3600_000) },
    });
    await setStaffActive(testDb, { userId: staffer.id, active: false, actor: await ctx(owner.id) });
    expect(await testDb.session.count({ where: { userId: staffer.id } })).toBe(0);
    expect(await loadStaffContext(testDb, staffer.id)).toBeNull();
  });
});
