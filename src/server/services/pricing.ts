/**
 * Pure pricing rules. Every total the store charges is computed here from
 * database values (rule 7). Amounts are integers in minor units.
 */

export type PricedLine = {
  productId: string;
  categoryId: string | null;
  unitPrice: number;
  quantity: number;
};

export type CouponRule = {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED";
  value: number;
  startsAt: Date | null;
  endsAt: Date | null;
  minSpend: number | null;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  isActive: boolean;
  restrictedProductIds: string[];
  restrictedCategoryIds: string[];
};

export type CouponUsage = { total: number; byCustomer: number };

export type CouponResult = { ok: true; discount: number } | { ok: false; reason: string };

export function subtotalOf(lines: PricedLine[]): number {
  return lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
}

function eligibleSubtotal(coupon: CouponRule, lines: PricedLine[]): number {
  const restricted =
    coupon.restrictedProductIds.length > 0 || coupon.restrictedCategoryIds.length > 0;
  if (!restricted) return subtotalOf(lines);
  return subtotalOf(
    lines.filter(
      (l) =>
        coupon.restrictedProductIds.includes(l.productId) ||
        (l.categoryId !== null && coupon.restrictedCategoryIds.includes(l.categoryId)),
    ),
  );
}

/** Checks every coupon rule and returns the discount. Shipping is never discounted. */
export function evaluateCoupon(
  coupon: CouponRule,
  lines: PricedLine[],
  usage: CouponUsage,
  now: Date,
  currencyFormat: (n: number) => string = String,
): CouponResult {
  if (!coupon.isActive) return { ok: false, reason: "This code is no longer active." };
  if (coupon.startsAt && now < coupon.startsAt)
    return { ok: false, reason: "This code is not active yet." };
  if (coupon.endsAt && now >= coupon.endsAt) return { ok: false, reason: "This code has expired." };
  if (lines.length === 0) return { ok: false, reason: "Your cart is empty." };
  const subtotal = subtotalOf(lines);
  if (coupon.minSpend !== null && subtotal < coupon.minSpend) {
    return {
      ok: false,
      reason: `Spend ${currencyFormat(coupon.minSpend)} or more to use this code.`,
    };
  }
  if (coupon.usageLimit !== null && usage.total >= coupon.usageLimit)
    return { ok: false, reason: "This code has reached its usage limit." };
  if (coupon.perCustomerLimit !== null && usage.byCustomer >= coupon.perCustomerLimit) {
    return { ok: false, reason: "You have already used this code the maximum number of times." };
  }
  const eligible = eligibleSubtotal(coupon, lines);
  if (eligible <= 0)
    return { ok: false, reason: "This code does not apply to the items in your cart." };
  const raw =
    coupon.type === "PERCENT"
      ? Math.floor((eligible * Math.min(100, Math.max(0, coupon.value))) / 100)
      : coupon.value;
  const discount = Math.max(0, Math.min(raw, eligible));
  return { ok: true, discount };
}

export type Totals = {
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  total: number;
};

export function computeTotals(lines: PricedLine[], discount: number, shipping: number): Totals {
  const subtotal = subtotalOf(lines);
  const discountTotal = Math.min(Math.max(0, discount), subtotal);
  const shippingTotal = Math.max(0, shipping);
  return {
    subtotal,
    discountTotal,
    shippingTotal,
    total: subtotal - discountTotal + shippingTotal,
  };
}

export function normaliseCouponCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}
