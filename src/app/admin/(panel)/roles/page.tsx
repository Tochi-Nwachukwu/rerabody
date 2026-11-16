import type { Metadata } from "next";

import { PageHeader } from "@/components/admin/page-header";
import { RolesEditor } from "@/components/admin/staff/roles-editor";
import { requirePagePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { OWNER_ROLE_NAME, PERMISSIONS, isPermission } from "@/server/permissions";

export const metadata: Metadata = { title: "Roles" };

// A26
export default async function RolesPage() {
  await requirePagePermission("roles.manage");
  const roles = await db.role.findMany({
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    include: { permissions: true, _count: { select: { users: true } } },
  });
  return (
    <>
      <PageHeader
        title="Roles"
        description="Choose what each role can do. Changes apply on the next page load for everyone with that role."
      />
      <RolesEditor
        roles={roles.map((r) => ({
          id: r.id,
          name: r.name,
          isSystem: r.isSystem && r.name === OWNER_ROLE_NAME,
          permissions:
            r.isSystem && r.name === OWNER_ROLE_NAME
              ? [...PERMISSIONS]
              : r.permissions.map((p) => p.permission).filter(isPermission),
          members: r._count.users,
        }))}
      />
    </>
  );
}
