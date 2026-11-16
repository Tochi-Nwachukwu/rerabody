/**
 * Permission strings and the default role mapping (BUILD_PLAN section 9,
 * build-plan.md "Admin flows"). Kept free of server-only imports so the seed
 * script and unit tests can use it.
 */

export const PERMISSIONS = [
  "products.read",
  "products.write",
  "inventory.read",
  "inventory.adjust",
  "orders.read",
  "orders.update",
  "orders.refund",
  "customers.read",
  "customers.update",
  "reviews.moderate",
  "coupons.manage",
  "content.manage",
  "media.upload",
  "media.delete",
  "support.manage",
  "reports.read",
  "staff.manage",
  "roles.manage",
  "settings.manage",
  "audit.read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const OWNER_ROLE_NAME = "Owner";

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

/** Default permissions for the seeded roles. Roles other than Owner can be edited in A26. */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, readonly Permission[]> = {
  [OWNER_ROLE_NAME]: PERMISSIONS,
  Manager: [
    "products.read",
    "products.write",
    "inventory.read",
    "inventory.adjust",
    "orders.read",
    "orders.update",
    "customers.read",
    "customers.update",
    "reviews.moderate",
    "coupons.manage",
    "content.manage",
    "media.upload",
    "media.delete",
    "support.manage",
    "reports.read",
  ],
  "Inventory staff": [
    "products.read",
    "products.write",
    "inventory.read",
    "inventory.adjust",
    "media.upload",
  ],
  "Fulfilment staff": ["orders.read", "orders.update"],
  "Content editor": ["content.manage", "media.upload", "media.delete"],
};
