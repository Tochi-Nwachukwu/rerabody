import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { TAGS } from "@/server/cache-tags";
import { db } from "@/server/db";
import { listProductReviews } from "@/server/services/reviews";

export async function getProductReviews(productId: string) {
  "use cache";
  cacheTag(TAGS.reviews(productId));
  cacheLife("max");
  const [reviews, distribution] = await Promise.all([
    listProductReviews(db, productId, 30),
    db.review.groupBy({
      by: ["rating"],
      where: { productId, status: "APPROVED" },
      _count: { _all: true },
    }),
  ]);
  return {
    reviews: reviews.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      author: r.user.name.split(" ")[0],
    })),
    distribution: Object.fromEntries(distribution.map((d) => [d.rating, d._count._all])) as Record<
      number,
      number
    >,
  };
}
