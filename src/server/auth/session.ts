import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { db } from "@/server/db";
import { AuthError } from "@/server/errors";
import type { Permission } from "@/server/permissions";
import {
  type StaffContext,
  checkPermission,
  loadStaffContext,
} from "@/server/services/staff-access";

import { auth } from "./auth";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  phone: string | null;
  roleId: string | null;
  status: string;
};

/** The signed-in user for this request, or null. Deduplicated per request. */
export const getSession = cache(
  async (): Promise<{ user: SessionUser; sessionId: string } | null> => {
    const result = await auth.api.getSession({ headers: await headers() });
    if (!result) return null;
    const u = result.user as typeof result.user & {
      phone?: string | null;
      roleId?: string | null;
      status?: string;
    };
    if (u.status === "DEACTIVATED") return null;
    return {
      sessionId: result.session.id,
      user: {
        id: u.id,
        name: u.name,
        email: u.email,
        emailVerified: u.emailVerified,
        phone: u.phone ?? null,
        roleId: u.roleId ?? null,
        status: u.status ?? "ACTIVE",
      },
    };
  },
);

/** The staff context for this request, or null for visitors and customers. */
export const getStaff = cache(async (): Promise<StaffContext | null> => {
  const session = await getSession();
  if (!session) return null;
  return loadStaffContext(db, session.user.id);
});

/** For pages: redirects signed-out visitors to the customer login. */
export async function requireUser(next?: string): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return session.user;
}

/** For admin pages: redirects visitors to A1 and refuses customers. */
export async function requireStaff(): Promise<StaffContext> {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  const staff = await loadStaffContext(db, session.user.id);
  if (!staff) redirect("/admin/login?error=no-access");
  return staff;
}

/**
 * For Server Actions and route handlers: throws AuthError unless the current
 * user is active staff holding the permission. Hiding a button is not a control.
 */
export async function requirePermission(permission: Permission): Promise<StaffContext> {
  const session = await getSession();
  return checkPermission(db, session?.user.id, permission);
}

/** For admin pages: renders the refusal page when the permission is missing. */
export async function requirePagePermission(permission: Permission): Promise<StaffContext> {
  const staff = await requireStaff();
  if (!staff.permissions.has(permission))
    redirect("/admin?denied=" + encodeURIComponent(permission));
  return staff;
}

export { AuthError };
