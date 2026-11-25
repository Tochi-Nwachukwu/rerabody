import Link from "next/link";
import type { ReactNode } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { requireStaff } from "@/server/auth/session";

import { AdminLogo } from "./admin-logo";
import { AdminMobileNav, AdminSidebar } from "./admin-nav";
import { visibleNav } from "./nav-items";

// A0 admin shell: sidebar by permission, top bar with the signed-in user.
export async function AdminShell({ children }: { children: ReactNode }) {
  const staff = await requireStaff();
  const items = visibleNav(staff.permissions);
  return (
    <div className="bg-background flex min-h-svh flex-1">
      <AdminSidebar items={items} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/95 sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-4 backdrop-blur">
          <AdminMobileNav items={items} />
          <Link href="/admin" className="lg:hidden">
            <AdminLogo className="h-8" />
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground hidden text-sm sm:inline"
              target="_blank"
            >
              View store
            </Link>
            <div className="hidden text-right text-sm leading-tight sm:block">
              <p className="font-medium">{staff.name}</p>
              <p className="text-muted-foreground text-xs">{staff.roleName}</p>
            </div>
            <SignOutButton redirectTo="/admin/login" variant="ghost" />
          </div>
        </header>
        <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export function AdminShellSkeleton() {
  return (
    <div className="flex min-h-svh flex-1">
      <div className="bg-sidebar hidden w-60 border-r lg:block" />
      <div className="flex-1">
        <div className="h-14 border-b" />
        <div className="text-muted-foreground p-6 text-sm">Loading…</div>
      </div>
    </div>
  );
}
