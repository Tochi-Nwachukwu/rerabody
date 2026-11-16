import type { PrismaClient } from "@/generated/prisma/client";
import type { couponSchema } from "@/lib/schemas/coupon";
import { UserError, isUniqueConstraintError } from "@/server/errors";
import type { z } from "zod";

import { audit } from "./audit";

const date = (v: string | null) => (v ? new Date(v) : null);

export async function saveCoupon(
  prisma: PrismaClient,
  input: z.output<typeof couponSchema>,
  actorId: string,
) {
  const before = input.id ? await prisma.coupon.findUnique({ where: { id: input.id } }) : null;
  if (input.id && !before) throw new UserError("This coupon no longer exists.");
  const data = {
    code: input.code,
    type: input.type,
    value: input.value,
    startsAt: date(input.startsAt),
    endsAt: date(input.endsAt),
    minSpend: input.minSpend,
    usageLimit: input.usageLimit,
    perCustomerLimit: input.perCustomerLimit,
    isActive: input.isActive,
    showOnOffers: input.showOnOffers,
    restrictedProductIds: input.restrictedProductIds,
    restrictedCategoryIds: input.restrictedCategoryIds,
  };
  try {
    const after = before
      ? await prisma.coupon.update({ where: { id: before.id }, data })
      : await prisma.coupon.create({ data });
    await audit(prisma, {
      actorId,
      action: before ? "coupon.update" : "coupon.create",
      targetType: "Coupon",
      targetId: after.id,
      before,
      after,
    });
    return after;
  } catch (error) {
    if (isUniqueConstraintError(error))
      throw new UserError("Another coupon already uses that code.");
    throw error;
  }
}

export async function setCouponActive(
  prisma: PrismaClient,
  input: { id: string; isActive: boolean; actorId: string },
) {
  const after = await prisma.coupon.update({
    where: { id: input.id },
    data: { isActive: input.isActive },
  });
  await audit(prisma, {
    actorId: input.actorId,
    action: input.isActive ? "coupon.enable" : "coupon.disable",
    targetType: "Coupon",
    targetId: input.id,
  });
  return after;
}

/** A15 list with usage and the revenue of orders that used each code. */
export async function listCoupons(prisma: PrismaClient) {
  const [coupons, stats] = await Promise.all([
    prisma.coupon.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.$queryRaw<{ couponId: string; uses: bigint; discount: bigint; revenue: bigint }[]>`
      SELECT r."couponId", COUNT(*) AS uses, COALESCE(SUM(r.amount), 0) AS discount, COALESCE(SUM(o.total), 0) AS revenue
      FROM "CouponRedemption" r JOIN "Order" o ON o.id = r."orderId"
      WHERE o.status NOT IN ('CANCELLED', 'REFUNDED')
      GROUP BY r."couponId"`,
  ]);
  const byId = new Map(
    stats.map((s) => [
      s.couponId,
      { uses: Number(s.uses), discount: Number(s.discount), revenue: Number(s.revenue) },
    ]),
  );
  return coupons.map((c) => ({
    ...c,
    stats: byId.get(c.id) ?? { uses: 0, discount: 0, revenue: 0 },
  }));
}
