"use server";

import { hashPassword } from "better-auth/crypto";
import { headers } from "next/headers";
import { z } from "zod";

import { emailField, passwordField } from "@/lib/schemas/auth";
import { absoluteUrl } from "@/lib/site";
import { auth } from "@/server/auth/auth";
import { db } from "@/server/db";
import { sendEmail } from "@/server/email";
import { PERMISSIONS } from "@/server/permissions";
import {
  acceptInvite,
  changeStaffRole,
  deleteRole,
  findValidInvite,
  inviteStaff,
  removeStaff,
  revokeInvite,
  saveRole,
  setStaffActive,
} from "@/server/services/staff";

import { adminAction, publicAction } from "./safe-action";

export const inviteStaffAction = adminAction(
  "staff.manage",
  z.object({ email: emailField, roleId: z.string() }),
  async (input, staff) => {
    const { invite, token, roleName } = await inviteStaff(db, { ...input, actor: staff });
    const url = absoluteUrl(
      `/admin/accept-invite?invite=${invite.id}&token=${encodeURIComponent(token)}`,
    );
    await sendEmail({
      template: "staff-invite",
      to: invite.email,
      dedupeKey: `invite:${invite.id}`,
      props: { invitedBy: staff.name, roleName, url },
    });
    return { id: invite.id };
  },
);

export const revokeInviteAction = adminAction(
  "staff.manage",
  z.object({ inviteId: z.string() }),
  async (input, staff) => revokeInvite(db, { ...input, actorId: staff.userId }),
);
export const changeStaffRoleAction = adminAction(
  "staff.manage",
  z.object({ userId: z.string(), roleId: z.string() }),
  async (input, staff) => changeStaffRole(db, { ...input, actor: staff }),
);
export const setStaffActiveAction = adminAction(
  "staff.manage",
  z.object({ userId: z.string(), active: z.boolean() }),
  async (input, staff) => setStaffActive(db, { ...input, actor: staff }),
);
export const removeStaffAction = adminAction(
  "staff.manage",
  z.object({ userId: z.string() }),
  async (input, staff) => removeStaff(db, { ...input, actor: staff }),
);

export const saveRoleAction = adminAction(
  "roles.manage",
  z.object({
    id: z.string().optional(),
    name: z.string().trim().min(1, "Name the role").max(40),
    permissions: z.array(z.enum(PERMISSIONS)),
  }),
  async (input, staff) => ({ id: (await saveRole(db, { ...input, actorId: staff.userId })).id }),
);
export const deleteRoleAction = adminAction(
  "roles.manage",
  z.object({ id: z.string() }),
  async (input, staff) => deleteRole(db, { ...input, actorId: staff.userId }),
);

/** A2: accepts the invite, then signs the new staff member in. */
export const acceptInviteAction = publicAction(
  z.object({
    inviteId: z.string(),
    token: z.string(),
    name: z.string().trim().min(1, "Enter your name").max(100),
    password: passwordField.optional(),
  }),
  async (input) => {
    const invite = await findValidInvite(db, input.inviteId, input.token);
    const passwordHash = input.password ? await hashPassword(input.password) : null;
    const result = await acceptInvite(db, {
      inviteId: input.inviteId,
      token: input.token,
      name: input.name,
      passwordHash,
    });
    if (result.created && invite && input.password) {
      await auth.api.signInEmail({
        body: { email: invite.email, password: input.password },
        headers: await headers(),
      });
      return { signedIn: true };
    }
    return { signedIn: false };
  },
);
