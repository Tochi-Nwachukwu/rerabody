import { describe, expect, it } from "vitest";

import {
  DEFAULT_ROLE_PERMISSIONS,
  OWNER_ROLE_NAME,
  PERMISSIONS,
  isPermission,
} from "@/server/permissions";

describe("default role permissions", () => {
  it("gives the Owner every permission", () => {
    expect([...DEFAULT_ROLE_PERMISSIONS[OWNER_ROLE_NAME]].sort()).toEqual([...PERMISSIONS].sort());
  });

  it("only uses known permission strings", () => {
    for (const perms of Object.values(DEFAULT_ROLE_PERMISSIONS)) {
      for (const p of perms) expect(isPermission(p)).toBe(true);
    }
  });

  it("keeps refunds, staff, roles and settings with the Owner only", () => {
    for (const [role, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      if (role === OWNER_ROLE_NAME) continue;
      for (const p of [
        "orders.refund",
        "staff.manage",
        "roles.manage",
        "settings.manage",
      ] as const) {
        expect(perms).not.toContain(p);
      }
    }
  });
});
