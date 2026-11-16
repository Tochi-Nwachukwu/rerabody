import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { TAGS } from "@/server/cache-tags";
import { db } from "@/server/db";

/** Active coupons the owner chose to show on the offers page. */
export async function getPublicCoupons() {
  "use cache";
  cacheTag(TAGS.offers);
  cacheLife("minutes");
  const now = new Date();
  const coupons = await db.coupon.findMany({
    where: {
      isActive: true,
      showOnOffers: true,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
    },
    orderBy: { createdAt: "desc" },
    select: { code: true, type: true, value: true, minSpend: true, endsAt: true },
  });
  return coupons.map((c) => ({ ...c, endsAt: c.endsAt?.toISOString() ?? null }));
}
