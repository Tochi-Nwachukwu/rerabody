import type { PrismaClient } from "@/generated/prisma/client";
import { AuthError } from "@/server/errors";
import { OWNER_ROLE_NAME, PERMISSIONS, type Permission, isPermission } from "@/server/permissions";

export type StaffContext = {
  userId: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  isOwner: boolean;
  permissions: ReadonlySet<Permission>;
};

/**
 * Loads the staff member behind a session. Returns null for unknown users,
 * customers (no role) and anyone who is not ACTIVE.
 */
export async function loadStaffContext(
  prisma: PrismaClient,
  userId: string,
): Promise<StaffContext | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      role: {
        select: {
          id: true,
          name: true,
          isSystem: true,
          permissions: { select: { permission: true } },
        },
      },
    },
  });
  if (!user || !user.role || user.status !== "ACTIVE") return null;

  const isOwner = user.role.isSystem && user.role.name === OWNER_ROLE_NAME;
  const permissions = new Set<Permission>(
    isOwner ? PERMISSIONS : user.role.permissions.map((p) => p.permission).filter(isPermission),
  );
  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    roleId: user.role.id,
    roleName: user.role.name,
    isOwner,
    permissions,
  };
}

export function hasPermission(ctx: StaffContext | null, permission: Permission): boolean {
  return !!ctx && ctx.permissions.has(permission);
}

/** Throws AuthError unless the user is an active staff member holding the permission. */
export async function checkPermission(
  prisma: PrismaClient,
  userId: string | null | undefined,
  permission: Permission,
): Promise<StaffContext> {
  if (!userId) throw new AuthError("UNAUTHENTICATED");
  const ctx = await loadStaffContext(prisma, userId);
  if (!ctx || !ctx.permissions.has(permission)) throw new AuthError("FORBIDDEN");
  return ctx;
}
