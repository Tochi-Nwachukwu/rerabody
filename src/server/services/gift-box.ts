import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { parseSetting } from "@/lib/settings";

import type { PricedLine } from "./pricing";

type Db = PrismaClient | Prisma.TransactionClient;

/** Products in this category are ready-made gift sets, each packed in a gift box. */
export const GIFT_SET_CATEGORY_SLUG = "gift-sets";
export const GIFT_BOX_SKU = "GIFT-BOX";
export const GIFT_BOX_NAME = "Gift box";

export type GiftBox = { quantity: number; unitPrice: number; total: number; categoryId: string };

/**
 * One gift box per gift set in the cart, at the fee set in Admin > Settings > Gift sets.
 * Null when there are no gift sets or the fee is zero.
 */
export async function giftBoxFor(
  db: Db,
  lines: { categoryId: string | null; quantity: number }[],
): Promise<GiftBox | null> {
  const category = await db.category.findUnique({
    where: { slug: GIFT_SET_CATEGORY_SLUG },
    select: { id: true },
  });
  if (!category) return null;
  const quantity = lines
    .filter((l) => l.categoryId === category.id)
    .reduce((n, l) => n + l.quantity, 0);
  if (quantity === 0) return null;
  const row = await db.siteSetting.findUnique({ where: { key: "giftSets" } });
  const { boxFee } = parseSetting("giftSets", row?.value);
  if (boxFee <= 0) return null;
  return { quantity, unitPrice: boxFee, total: boxFee * quantity, categoryId: category.id };
}

/** The gift box as a priced line, so subtotals, coupons and totals include it. */
export function giftBoxPricedLine(box: GiftBox): PricedLine {
  return {
    productId: GIFT_BOX_SKU,
    categoryId: box.categoryId,
    unitPrice: box.unitPrice,
    quantity: box.quantity,
  };
}
