"use server";

import { z } from "zod";

import { couponSchema } from "@/lib/schemas/coupon";
import { TAGS, expireTags } from "@/server/cache-tags";
import { db } from "@/server/db";
import { saveCoupon, setCouponActive } from "@/server/services/coupon-admin";

import { adminAction } from "./safe-action";

export const saveCouponAction = adminAction(
  "coupons.manage",
  couponSchema,
  async (input, staff) => {
    const c = await saveCoupon(db, input, staff.userId);
    expireTags(TAGS.offers);
    return { id: c.id };
  },
);

export const setCouponActiveAction = adminAction(
  "coupons.manage",
  z.object({ id: z.string(), isActive: z.boolean() }),
  async (input, staff) => {
    await setCouponActive(db, { ...input, actorId: staff.userId });
    expireTags(TAGS.offers);
  },
);
