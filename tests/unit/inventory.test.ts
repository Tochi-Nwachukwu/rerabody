import { beforeEach, describe, expect, it } from "vitest";

import { adjustStock } from "@/server/services/inventory";

import { resetDb, testDb } from "../helpers/db";
import { createProduct, createRole, createUser } from "../helpers/factories";

describe("inventory adjustment", () => {
  let actorId: string;
  beforeEach(async () => {
    await resetDb();
    const role = await createRole("Inventory staff");
    actorId = (await createUser({ roleId: role.id })).id;
  });

  it("restocks, records a movement and an audit entry", async () => {
    const p = await createProduct({ variants: [{ stock: 3 }] });
    const v = p.variants[0];
    const res = await adjustStock(testDb, {
      variantId: v.id,
      mode: "delta",
      amount: 7,
      reason: "RESTOCK",
      note: "Delivery",
      actorId,
    });
    expect(res.stock).toBe(10);
    const moves = await testDb.inventoryMovement.findMany({ where: { variantId: v.id } });
    expect(moves).toEqual([
      expect.objectContaining({ delta: 7, reason: "RESTOCK", note: "Delivery", actorId }),
    ]);
    expect(
      await testDb.auditLog.count({ where: { action: "inventory.adjust", targetId: v.id } }),
    ).toBe(1);
  });

  it("sets an absolute count as a correction", async () => {
    const p = await createProduct({ variants: [{ stock: 12 }] });
    const res = await adjustStock(testDb, {
      variantId: p.variants[0].id,
      mode: "set",
      amount: 9,
      reason: "CORRECTION",
      note: null,
      actorId,
    });
    expect(res).toMatchObject({ stock: 9, delta: -3 });
  });

  it("never lets stock go below zero", async () => {
    const p = await createProduct({ variants: [{ stock: 2 }] });
    await expect(
      adjustStock(testDb, {
        variantId: p.variants[0].id,
        mode: "delta",
        amount: -3,
        reason: "DAMAGE",
        note: null,
        actorId,
      }),
    ).rejects.toThrow(/Only 2 in stock/);
    expect(
      (await testDb.productVariant.findUniqueOrThrow({ where: { id: p.variants[0].id } })).stock,
    ).toBe(2);
    expect(await testDb.inventoryMovement.count()).toBe(0);
  });

  it("refuses reasons that do not fit the direction", async () => {
    const p = await createProduct({ variants: [{ stock: 5 }] });
    await expect(
      adjustStock(testDb, {
        variantId: p.variants[0].id,
        mode: "delta",
        amount: -1,
        reason: "RESTOCK",
        note: null,
        actorId,
      }),
    ).rejects.toThrow(/restock must add/i);
    await expect(
      adjustStock(testDb, {
        variantId: p.variants[0].id,
        mode: "delta",
        amount: 1,
        reason: "DAMAGE",
        note: null,
        actorId,
      }),
    ).rejects.toThrow(/Damage/);
  });

  it("two concurrent removals of the last units cannot both succeed", async () => {
    const p = await createProduct({ variants: [{ stock: 1 }] });
    const results = await Promise.allSettled([
      adjustStock(testDb, {
        variantId: p.variants[0].id,
        mode: "delta",
        amount: -1,
        reason: "DAMAGE",
        note: null,
        actorId,
      }),
      adjustStock(testDb, {
        variantId: p.variants[0].id,
        mode: "delta",
        amount: -1,
        reason: "DAMAGE",
        note: null,
        actorId,
      }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      (await testDb.productVariant.findUniqueOrThrow({ where: { id: p.variants[0].id } })).stock,
    ).toBe(0);
  });
});
