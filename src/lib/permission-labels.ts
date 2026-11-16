import type { Permission } from "@/server/permissions";

/** Grouped, plain-English labels for the A26 permission grid. */
export const PERMISSION_GROUPS: { title: string; items: { key: Permission; label: string }[] }[] = [
  {
    title: "Catalogue",
    items: [
      { key: "products.read", label: "View products" },
      { key: "products.write", label: "Edit products, categories and collections" },
    ],
  },
  {
    title: "Inventory",
    items: [
      { key: "inventory.read", label: "View stock" },
      { key: "inventory.adjust", label: "Adjust stock" },
    ],
  },
  {
    title: "Orders",
    items: [
      { key: "orders.read", label: "View orders" },
      { key: "orders.update", label: "Update status, tracking and notes" },
      { key: "orders.refund", label: "Refund and cancel paid orders" },
    ],
  },
  {
    title: "Customers",
    items: [
      { key: "customers.read", label: "View customers" },
      { key: "customers.update", label: "Edit and deactivate customers" },
    ],
  },
  {
    title: "Marketing",
    items: [
      { key: "reviews.moderate", label: "Moderate reviews" },
      { key: "coupons.manage", label: "Manage coupons" },
    ],
  },
  {
    title: "Content",
    items: [
      { key: "content.manage", label: "Homepage, pages and FAQ" },
      { key: "media.upload", label: "Upload images" },
      { key: "media.delete", label: "Delete images" },
    ],
  },
  {
    title: "Support and reports",
    items: [
      { key: "support.manage", label: "Answer support tickets" },
      { key: "reports.read", label: "View reports" },
    ],
  },
  {
    title: "Administration",
    items: [
      { key: "staff.manage", label: "Invite and manage staff" },
      { key: "roles.manage", label: "Edit roles" },
      { key: "settings.manage", label: "Store settings" },
      { key: "audit.read", label: "View audit log" },
    ],
  },
];
