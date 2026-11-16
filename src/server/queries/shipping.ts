import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { TAGS } from "@/server/cache-tags";
import { db } from "@/server/db";

export async function getActiveShippingMethods() {
  "use cache";
  cacheTag(TAGS.shipping);
  cacheLife("max");
  return db.shippingMethod.findMany({
    where: { isActive: true },
    orderBy: { price: "asc" },
    select: { id: true, name: true, price: true, estimate: true, region: true },
  });
}
