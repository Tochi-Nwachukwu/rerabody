import { Suspense } from "react";

import { AdminShell, AdminShellSkeleton } from "@/components/admin/admin-shell";

export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<AdminShellSkeleton />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
