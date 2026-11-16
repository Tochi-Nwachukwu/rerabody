import type { Metadata } from "next";

import { PageHeader } from "@/components/admin/page-header";
import { StaffManager } from "@/components/admin/staff/staff-manager";
import { requirePagePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { OWNER_ROLE_NAME } from "@/server/permissions";

export const metadata: Metadata = { title: "Staff" };

// A25
export default async function StaffPage() {
  const staff = await requirePagePermission("staff.manage");
  const [members, invites, roles] = await Promise.all([
    db.user.findMany({
      where: { roleId: { not: null } },
      orderBy: { name: "asc" },
      include: { role: true },
    }),
    db.staffInvite.findMany({
      where: { acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      include: { role: { select: { name: true } } },
    }),
    db.role.findMany({ orderBy: [{ isSystem: "desc" }, { name: "asc" }] }),
  ]);
  const isOwnerRole = (r: { isSystem: boolean; name: string } | null) =>
    !!r && r.isSystem && r.name === OWNER_ROLE_NAME;
  return (
    <>
      <PageHeader
        title="Staff"
        description="Invite people and choose what they can do. Every admin action is recorded in the audit log."
      />
      <StaffManager
        canInviteOwner={staff.isOwner}
        roles={roles.map((r) => ({ id: r.id, name: r.name, isOwner: isOwnerRole(r) }))}
        members={members.map((m) => ({
          id: m.id,
          name: m.name,
          email: m.email,
          roleId: m.roleId!,
          roleName: m.role!.name,
          status: m.status,
          isOwner: isOwnerRole(m.role),
          isYou: m.id === staff.userId,
        }))}
        invites={invites.map((i) => ({
          id: i.id,
          email: i.email,
          roleName: i.role.name,
          expiresAt: i.expiresAt.toISOString(),
        }))}
      />
    </>
  );
}
