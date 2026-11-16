import type { Prisma, PrismaClient } from "@/generated/prisma/client";

import {
  type CouponResult,
  type CouponRule,
  type PricedLine,
  evaluateCoupon,
  normaliseCouponCode,
} from "./pricing";

type Db = PrismaClient | Prisma.TransactionClient;

export async function findCouponByCode(db: Db, code: string) {
  const normalised = normaliseCouponCode(code);
  if (!normalised) return null;
  return db.coupon.findUnique({ where: { code: normalised } });
}

/** Redemptions so far, overall and for this customer (matched by user id or email). */
export async function couponUsage(
  db: Db,
  couponId: string,
  customer: { userId?: string | null; email?: string | null },
) {
  const or: Prisma.CouponRedemptionWhereInput[] = [];
  if (customer.userId) or.push({ userId: customer.userId });
  if (customer.email) or.push({ email: customer.email.toLowerCase() });
  const [total, byCustomer] = await Promise.all([
    db.couponRedemption.count({ where: { couponId } }),
    or.length ? db.couponRedemption.count({ where: { couponId, OR: or } }) : Promise.resolve(0),
  ]);
  return { total, byCustomer };
}

/** Loads the coupon and its usage, then applies every rule. Used when applying in the cart and again at order creation (rule 8). */
export async function validateCoupon(
  db: Db,
  code: string,
  lines: PricedLine[],
  customer: { userId?: string | null; email?: string | null },
  now: Date,
  format?: (n: number) => string,
): Promise<{ coupon: CouponRule | null; result: CouponResult }> {
  const coupon = await findCouponByCode(db, code);
  if (!coupon)
    return { coupon: null, result: { ok: false, reason: "We do not recognise that code." } };
  const usage = await couponUsage(db, coupon.id, customer);
  return { coupon, result: evaluateCoupon(coupon, lines, usage, now, format) };
}
