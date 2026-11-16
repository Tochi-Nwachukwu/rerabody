"use client";

import {
  Boxes,
  ChartLine,
  CircleHelp,
  FileText,
  History,
  House,
  Image,
  LayoutDashboard,
  LayoutGrid,
  LifeBuoy,
  Menu,
  Package,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Star,
  Tags,
  TicketPercent,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import type { AdminNavItem } from "./nav-items";

const ICONS: Record<string, LucideIcon> = {
  Boxes,
  ChartLine,
  CircleHelp,
  FileText,
  History,
  House,
  Image,
  LayoutDashboard,
  LayoutGrid,
  LifeBuoy,
  Package,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Star,
  Tags,
  TicketPercent,
  UserCog,
  Users,
};

const GROUPS: AdminNavItem["group"][] = ["Overview", "Sales", "Catalogue", "Content", "Team"];

function NavList({ items, onNavigate }: { items: AdminNavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
  return (
    <nav aria-label="Admin" className="flex flex-col gap-5">
      {GROUPS.map((group) => {
        const groupItems = items.filter((i) => i.group === group);
        if (groupItems.length === 0) return null;
        return (
          <div key={group} className="flex flex-col gap-0.5">
            <p className="text-muted-foreground px-2 pb-1 text-xs font-medium tracking-wide uppercase">
              {group}
            </p>
            {groupItems.map((item) => {
              const Icon = ICONS[item.icon] ?? LayoutDashboard;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "hover:bg-sidebar-accent flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                    active && "bg-sidebar-accent font-medium",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

export function AdminSidebar({ items }: { items: AdminNavItem[] }) {
  return (
    <aside className="bg-sidebar hidden w-60 shrink-0 border-r px-3 py-5 lg:block">
      <Link
        href="/admin"
        className="font-heading mb-6 block px-2 text-xl font-semibold tracking-[0.1em] uppercase"
      >
        Rera Body
      </Link>
      <NavList items={items} />
    </aside>
  );
}

export function AdminMobileNav({ items }: { items: AdminNavItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu" />}
      >
        <Menu />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 overflow-y-auto px-3">
        <SheetHeader className="px-2">
          <SheetTitle className="font-heading text-xl tracking-[0.1em] uppercase">
            Rera Body
          </SheetTitle>
        </SheetHeader>
        <NavList items={items} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
