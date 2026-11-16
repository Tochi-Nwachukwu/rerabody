import type { Permission } from "@/server/permissions";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: string;
  /** Shown when the user holds any of these. Empty means every staff member. */
  anyOf: Permission[];
  group: "Overview" | "Catalogue" | "Sales" | "Content" | "Team";
};

// A0 sidebar. Links show by permission; the pages check permissions again on the server.
export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "LayoutDashboard", anyOf: [], group: "Overview" },
  {
    href: "/admin/reports",
    label: "Reports",
    icon: "ChartLine",
    anyOf: ["reports.read"],
    group: "Overview",
  },
  {
    href: "/admin/orders",
    label: "Orders",
    icon: "ShoppingBag",
    anyOf: ["orders.read"],
    group: "Sales",
  },
  {
    href: "/admin/customers",
    label: "Customers",
    icon: "Users",
    anyOf: ["customers.read"],
    group: "Sales",
  },
  {
    href: "/admin/coupons",
    label: "Coupons",
    icon: "TicketPercent",
    anyOf: ["coupons.manage"],
    group: "Sales",
  },
  {
    href: "/admin/reviews",
    label: "Reviews",
    icon: "Star",
    anyOf: ["reviews.moderate"],
    group: "Sales",
  },
  {
    href: "/admin/support",
    label: "Support",
    icon: "LifeBuoy",
    anyOf: ["support.manage"],
    group: "Sales",
  },
  {
    href: "/admin/products",
    label: "Products",
    icon: "Package",
    anyOf: ["products.read"],
    group: "Catalogue",
  },
  {
    href: "/admin/categories",
    label: "Categories",
    icon: "Tags",
    anyOf: ["products.write"],
    group: "Catalogue",
  },
  {
    href: "/admin/collections",
    label: "Collections",
    icon: "LayoutGrid",
    anyOf: ["products.write"],
    group: "Catalogue",
  },
  {
    href: "/admin/inventory",
    label: "Inventory",
    icon: "Boxes",
    anyOf: ["inventory.read"],
    group: "Catalogue",
  },
  {
    href: "/admin/content/homepage",
    label: "Homepage",
    icon: "House",
    anyOf: ["content.manage"],
    group: "Content",
  },
  {
    href: "/admin/content/pages",
    label: "Pages",
    icon: "FileText",
    anyOf: ["content.manage"],
    group: "Content",
  },
  {
    href: "/admin/content/faq",
    label: "FAQ",
    icon: "CircleHelp",
    anyOf: ["content.manage"],
    group: "Content",
  },
  {
    href: "/admin/media",
    label: "Media",
    icon: "Image",
    anyOf: ["media.upload", "media.delete", "content.manage", "products.write"],
    group: "Content",
  },
  { href: "/admin/staff", label: "Staff", icon: "UserCog", anyOf: ["staff.manage"], group: "Team" },
  {
    href: "/admin/roles",
    label: "Roles",
    icon: "ShieldCheck",
    anyOf: ["roles.manage"],
    group: "Team",
  },
  {
    href: "/admin/audit",
    label: "Audit log",
    icon: "History",
    anyOf: ["audit.read"],
    group: "Team",
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: "Settings",
    anyOf: ["settings.manage"],
    group: "Team",
  },
];

export function visibleNav(permissions: ReadonlySet<Permission>): AdminNavItem[] {
  return ADMIN_NAV.filter(
    (item) => item.anyOf.length === 0 || item.anyOf.some((p) => permissions.has(p)),
  );
}
