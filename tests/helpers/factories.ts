import { DEFAULT_ROLE_PERMISSIONS, OWNER_ROLE_NAME } from "@/server/permissions";

import { testDb } from "./db";

let seq = 0;
export const uid = (prefix = "x") => `${prefix}${++seq}${Math.random().toString(36).slice(2, 6)}`;

export async function createRole(
  name: keyof typeof DEFAULT_ROLE_PERMISSIONS | string,
  permissions?: readonly string[],
) {
  const perms = permissions ?? DEFAULT_ROLE_PERMISSIONS[name] ?? [];
  return testDb.role.create({
    data: {
      name,
      isSystem: name === OWNER_ROLE_NAME,
      permissions: { create: perms.map((permission) => ({ permission })) },
    },
  });
}

export async function createUser(
  opts: {
    roleId?: string | null;
    status?: "ACTIVE" | "INVITED" | "DEACTIVATED";
    email?: string;
    name?: string;
  } = {},
) {
  return testDb.user.create({
    data: {
      name: opts.name ?? "Test user",
      email: opts.email ?? `${uid("user")}@example.test`,
      emailVerified: true,
      roleId: opts.roleId ?? null,
      status: opts.status ?? "ACTIVE",
    },
  });
}
