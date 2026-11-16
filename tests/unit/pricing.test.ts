import { describe, expect, it } from "vitest";

import {
  type CouponRule,
  computeTotals,
  evaluateCoupon,
  normaliseCouponCode,
} from "@/server/services/pricing";

const now = new Date("2026-06-01T12:00:00Z");
const lines = [
  { productId: "butter", categoryId: "bb", unitPrice: 1800, quantity: 2 },
  { productId: "slip", categoryId: "nw", unitPrice: 4500, quantity: 1 },
];
const coupon = (o: Partial<CouponRule> = {}): CouponRule => ({
  id: "c1",
  code: "SAVE10",
  type: "PERCENT",
  value: 10,
  startsAt: null,
  endsAt: null,
  minSpend: null,
  usageLimit: null,
  perCustomerLimit: null,
  isActive: true,
  restrictedProductIds: [],
  restrictedCategoryIds: [],
  ...o,
});
const unused = { total: 0, byCustomer: 0 };

describe("totals", () => {
  it("adds lines, subtracts the discount and adds shipping", () => {
    expect(computeTotals(lines, 810, 395)).toEqual({
      subtotal: 8100,
      discountTotal: 810,
      shippingTotal: 395,
      total: 7685,
    });
  });
  it("never discounts below zero or past the subtotal", () => {
    expect(computeTotals(lines, 99_999, 0)).toMatchObject({ discountTotal: 8100, total: 0 });
    expect(computeTotals(lines, -5, 0).discountTotal).toBe(0);
  });
});

describe("coupon rules", () => {
  it("applies a percentage to the subtotal, rounding down", () => {
    expect(evaluateCoupon(coupon({ value: 15 }), lines, unused, now)).toEqual({
      ok: true,
      discount: 1215,
    });
    expect(
      evaluateCoupon(
        coupon({ value: 33 }),
        [{ productId: "x", categoryId: null, unitPrice: 999, quantity: 1 }],
        unused,
        now,
      ),
    ).toEqual({ ok: true, discount: 329 });
  });
  it("applies a fixed amount capped at the eligible subtotal", () => {
    expect(evaluateCoupon(coupon({ type: "FIXED", value: 500 }), lines, unused, now)).toEqual({
      ok: true,
      discount: 500,
    });
    expect(evaluateCoupon(coupon({ type: "FIXED", value: 50_000 }), lines, unused, now)).toEqual({
      ok: true,
      discount: 8100,
    });
  });
  it("rejects inactive codes", () => {
    expect(evaluateCoupon(coupon({ isActive: false }), lines, unused, now)).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/no longer active/),
    });
  });
  it("rejects codes before their start date and at or after their end date", () => {
    expect(
      evaluateCoupon(coupon({ startsAt: new Date("2026-06-02") }), lines, unused, now),
    ).toMatchObject({ ok: false, reason: expect.stringMatching(/not active yet/) });
    expect(evaluateCoupon(coupon({ endsAt: now }), lines, unused, now)).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/expired/),
    });
    expect(
      evaluateCoupon(
        coupon({ startsAt: new Date("2026-05-01"), endsAt: new Date("2026-07-01") }),
        lines,
        unused,
        now,
      ).ok,
    ).toBe(true);
  });
  it("enforces minimum spend on the cart subtotal", () => {
    expect(
      evaluateCoupon(coupon({ minSpend: 8101 }), lines, unused, now, (n) => `£${n / 100}`),
    ).toMatchObject({ ok: false, reason: "Spend £81.01 or more to use this code." });
    expect(evaluateCoupon(coupon({ minSpend: 8100 }), lines, unused, now).ok).toBe(true);
  });
  it("enforces the total usage limit", () => {
    expect(
      evaluateCoupon(coupon({ usageLimit: 3 }), lines, { total: 3, byCustomer: 0 }, now),
    ).toMatchObject({ ok: false, reason: expect.stringMatching(/usage limit/) });
    expect(
      evaluateCoupon(coupon({ usageLimit: 3 }), lines, { total: 2, byCustomer: 0 }, now).ok,
    ).toBe(true);
  });
  it("enforces the per-customer limit", () => {
    expect(
      evaluateCoupon(coupon({ perCustomerLimit: 1 }), lines, { total: 5, byCustomer: 1 }, now),
    ).toMatchObject({ ok: false, reason: expect.stringMatching(/maximum number of times/) });
  });
  it("restricts the discount to chosen products", () => {
    expect(
      evaluateCoupon(coupon({ value: 10, restrictedProductIds: ["slip"] }), lines, unused, now),
    ).toEqual({ ok: true, discount: 450 });
  });
  it("restricts the discount to chosen categories", () => {
    expect(
      evaluateCoupon(
        coupon({ type: "FIXED", value: 10_000, restrictedCategoryIds: ["bb"] }),
        lines,
        unused,
        now,
      ),
    ).toEqual({ ok: true, discount: 3600 });
  });
  it("rejects codes that match nothing in the cart", () => {
    expect(
      evaluateCoupon(coupon({ restrictedProductIds: ["other"] }), lines, unused, now),
    ).toMatchObject({ ok: false, reason: expect.stringMatching(/does not apply/) });
  });
  it("rejects an empty cart", () => {
    expect(evaluateCoupon(coupon(), [], unused, now).ok).toBe(false);
  });
  it("normalises codes", () => {
    expect(normaliseCouponCode("  save 10 ")).toBe("SAVE10");
  });
});
