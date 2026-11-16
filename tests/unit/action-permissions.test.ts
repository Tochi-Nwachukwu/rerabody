import { beforeEach, describe, expect, it, vi } from "vitest";

import { checkPermission } from "@/server/services/staff-access";

import { resetDb, testDb } from "../helpers/db";
import { createProduct, createRole, createUser, uid } from "../helpers/factories";

// Run the real Server Actions against the test database with a chosen signed-in user.
let currentUserId: string | null = null;
vi.mock("@/server/db", () => ({ db: testDb }));
vi.mock("next/cache", () => ({
  revalidateTag: () => {},
  updateTag: () => {},
  cacheTag: () => {},
  cacheLife: () => {},
}));
vi.mock("@/server/notifications/orders", () => ({
  notifyOrderStatus: async () => {},
  notifyRefund: async () => {},
  reviewLink: () => "",
  orderTrackingLink: () => "",
}));
vi.mock("@/server/auth/session", () => ({
  getSession: async () =>
    currentUserId ? { user: { id: currentUserId, email: "x@example.test", name: "X" } } : null,
  requirePermission: (permission: Parameters<typeof checkPermission>[2]) =>
    checkPermission(testDb, currentUserId, permission),
}));

const { saveProductAction } = await import("@/server/actions/catalogue");
const { updateOrderStatusAction } = await import("@/server/actions/orders");

describe("Server Actions check permissions on the server", () => {
  beforeEach(async () => {
    await resetDb();
    currentUserId = (await createUser({ roleId: (await createRole("Fulfilment staff")).id })).id;
  });

  it("Fulfilment staff can update an order", async () => {
    const p = await createProduct();
    const order = await testDb.order.create({
      data: {
        number: uid("RB-"),
        email: "a@example.test",
        status: "PAID",
        subtotal: 1000,
        total: 1000,
        currency: "GBP",
        shippingAddress: {},
        shippingMethod: {},
        items: {
          create: {
            productId: p.id,
            variantId: p.variants[0].id,
            productName: p.name,
            variantLabel: "Default",
            sku: p.variants[0].sku,
            unitPrice: 1000,
            quantity: 1,
            lineTotal: 1000,
          },
        },
      },
    });
    const res = await updateOrderStatusAction({ orderId: order.id, to: "PROCESSING" });
    expect(res).toEqual({ ok: true, data: { from: "PAID", to: "PROCESSING" } });
  });

  it("Fulfilment staff calling a product action directly is refused and nothing is written", async () => {
    const res = await saveProductAction({
      name: "Sneaky",
      slug: "sneaky",
      status: "PUBLISHED",
      categoryId: null,
      collectionIds: [],
      description: null,
      specs: null,
      sizeGuide: null,
      metaTitle: null,
      metaDescription: null,
      images: [],
      options: [],
      variants: [
        {
          optionValues: {},
          sku: "SNEAKY",
          price: 1,
          compareAtPrice: null,
          initialStock: 0,
          lowStockThreshold: 0,
          imageId: null,
          isActive: true,
        },
      ],
    });
    expect(res).toEqual({ ok: false, error: "You do not have permission to do that." });
    expect(await testDb.product.count({ where: { slug: "sneaky" } })).toBe(0);
  });

  it("signed-out callers are refused", async () => {
    currentUserId = null;
    const res = await updateOrderStatusAction({ orderId: "x", to: "PROCESSING" });
    expect(res).toEqual({ ok: false, error: "Please sign in." });
  });

  it("invalid input is rejected before any check", async () => {
    const res = await updateOrderStatusAction({ orderId: "x", to: "REFUNDED" as never });
    expect(res.ok).toBe(false);
  });
});
