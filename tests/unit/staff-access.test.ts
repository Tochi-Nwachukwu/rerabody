import { beforeEach, describe, expect, it } from "vitest";

import { AuthError } from "@/server/errors";
import { checkPermission, loadStaffContext } from "@/server/services/staff-access";

import { resetDb, testDb } from "../helpers/db";
import { createRole, createUser } from "../helpers/factories";

describe("requirePermission (checkPermission)", () => {
  beforeEach(resetDb);

  it("allows an active staff member holding the permission", async () => {
    const role = await createRole("Fulfilment staff");
    const user = await createUser({ roleId: role.id });
    const ctx = await checkPermission(testDb, user.id, "orders.update");
    expect(ctx.userId).toBe(user.id);
    expect(ctx.roleName).toBe("Fulfilment staff");
  });

  it("refuses a staff member without the permission", async () => {
    const role = await createRole("Fulfilment staff");
    const user = await createUser({ roleId: role.id });
    await expect(checkPermission(testDb, user.id, "products.write")).rejects.toMatchObject({
      name: "AuthError",
      code: "FORBIDDEN",
    });
  });

  it("refuses a deactivated staff member even if the role holds the permission", async () => {
    const role = await createRole("Manager");
    const user = await createUser({ roleId: role.id, status: "DEACTIVATED" });
    await expect(checkPermission(testDb, user.id, "orders.read")).rejects.toBeInstanceOf(AuthError);
    expect(await loadStaffContext(testDb, user.id)).toBeNull();
  });

  it("refuses invited staff who have not accepted yet", async () => {
    const role = await createRole("Manager");
    const user = await createUser({ roleId: role.id, status: "INVITED" });
    await expect(checkPermission(testDb, user.id, "orders.read")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("refuses customers", async () => {
    const user = await createUser({ roleId: null });
    await expect(checkPermission(testDb, user.id, "orders.read")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("refuses signed-out visitors", async () => {
    await expect(checkPermission(testDb, null, "orders.read")).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("gives the Owner every permission even if a row is missing", async () => {
    const role = await createRole("Owner", []);
    const user = await createUser({ roleId: role.id });
    const ctx = await checkPermission(testDb, user.id, "settings.manage");
    expect(ctx.isOwner).toBe(true);
  });
});
