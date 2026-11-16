import { beforeEach, describe, expect, it } from "vitest";

import { isAuthorisedCron } from "@/server/cron";
import { couponReport, salesReport, toCsv, topProducts } from "@/server/services/reports";

import { resetDb, testDb } from "../helpers/db";
import { createProduct, uid } from "../helpers/factories";

const day = (d: string) => new Date(`${d}T12:00:00Z`);

describe("reports", () => {
  beforeEach(resetDb);

  it("totals match a hand-calculated sum", async () => {
    const p = await createProduct({ name: "Butter" });
    const coupon = await testDb.coupon.create({
      data: { code: "TEN", type: "PERCENT", value: 10 },
    });
    const orders: {
      status: "PAID" | "DELIVERED" | "CANCELLED" | "REFUNDED" | "SHIPPED";
      total: number;
      paidAt: Date;
      refunded?: number;
      qty: number;
      coupon?: boolean;
    }[] = [
      { status: "PAID", total: 2000, paidAt: day("2026-03-01"), qty: 1, coupon: true },
      { status: "DELIVERED", total: 4500, paidAt: day("2026-03-01"), qty: 2 },
      { status: "SHIPPED", total: 3000, paidAt: day("2026-03-02"), refunded: 1000, qty: 1 },
      { status: "REFUNDED", total: 5000, paidAt: day("2026-03-02"), refunded: 5000, qty: 3 },
      { status: "CANCELLED", total: 1200, paidAt: day("2026-03-03"), refunded: 1200, qty: 1 },
      { status: "PAID", total: 9999, paidAt: day("2026-04-15"), qty: 1 }, // outside the range
    ];
    for (const o of orders) {
      const order = await testDb.order.create({
        data: {
          number: uid("RB-"),
          email: "a@example.test",
          status: o.status,
          subtotal: o.total,
          total: o.total,
          currency: "GBP",
          shippingAddress: {},
          shippingMethod: {},
          paidAt: o.paidAt,
          items: {
            create: {
              productId: p.id,
              productName: "Butter",
              variantLabel: "Default",
              sku: "B",
              unitPrice: Math.round(o.total / o.qty),
              quantity: o.qty,
              lineTotal: o.total,
            },
          },
          payments: {
            create: {
              provider: "fake",
              amount: o.total,
              status: "SUCCEEDED",
              refundedAmount: o.refunded ?? 0,
            },
          },
        },
      });
      if (o.coupon)
        await testDb.couponRedemption.create({
          data: { couponId: coupon.id, orderId: order.id, email: "a@example.test", amount: 200 },
        });
    }

    const r = await salesReport(
      testDb,
      { from: new Date("2026-03-01T00:00:00Z"), to: new Date("2026-04-01T00:00:00Z") },
      "day",
    );
    // Gross in range: 2000 + 4500 + 3000 + 5000 + 1200 = 15700. Refunds: 1000 + 5000 + 1200 = 7200.
    expect(r.revenue).toBe(15700 - 7200);
    expect(r.refunds).toBe(7200);
    // Counted orders: PAID, DELIVERED, SHIPPED = 3; their gross 9500 -> AOV 3167.
    expect(r.orders).toBe(3);
    expect(r.averageOrderValue).toBe(Math.round(9500 / 3));
    expect(r.series).toEqual([
      { bucket: "2026-03-01", revenue: 6500, orders: 2 },
      { bucket: "2026-03-02", revenue: 2000, orders: 1 },
      { bucket: "2026-03-03", revenue: 0, orders: 0 },
    ]);

    const top = await topProducts(testDb, {
      from: new Date("2026-03-01T00:00:00Z"),
      to: new Date("2026-04-01T00:00:00Z"),
    });
    expect(top).toEqual([{ productId: p.id, name: "Butter", units: 4, revenue: 9500 }]);
    expect(
      await couponReport(testDb, {
        from: new Date("2026-03-01T00:00:00Z"),
        to: new Date("2026-04-01T00:00:00Z"),
      }),
    ).toEqual([{ code: "TEN", uses: 1, discount: 200, revenue: 2000 }]);
  });

  it("writes safe CSV", () => {
    expect(toCsv(["a", "b"], [["=SUM(A1)", 'He said "hi", ok']])).toBe(
      `a,b\r\n'=SUM(A1),"He said ""hi"", ok"\r\n`,
    );
  });

  it("accepts only the cron secret", () => {
    const secret = "s".repeat(24);
    expect(isAuthorisedCron(new Headers({ authorization: `Bearer ${secret}` }), secret)).toBe(true);
    expect(isAuthorisedCron(new Headers({ "x-cron-secret": secret }), secret)).toBe(true);
    expect(isAuthorisedCron(new Headers({ authorization: "Bearer nope" }), secret)).toBe(false);
    expect(isAuthorisedCron(new Headers(), secret)).toBe(false);
  });
});
