import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { TAGS } from "@/server/cache-tags";
import { db } from "@/server/db";
import { loadPublishedSections } from "@/server/services/home-sections";

export async function getPublishedHomeSections() {
  "use cache";
  cacheTag(TAGS.home);
  cacheLife("max");
  return loadPublishedSections(db);
}

export async function getMediaByIds(ids: string[]) {
  "use cache";
  cacheTag(TAGS.media, TAGS.home);
  cacheLife("max");
  if (!ids.length) return [];
  return db.media.findMany({
    where: { id: { in: ids } },
    select: { id: true, url: true, alt: true, width: true, height: true },
  });
}

/** Approved reviews the owner featured, for the testimonials section. */
export async function getFeaturedReviews(limit: number) {
  "use cache";
  cacheTag(TAGS.featuredReviews);
  cacheLife("max");
  return db.review.findMany({
    where: { status: "APPROVED", isFeatured: true },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      rating: true,
      title: true,
      body: true,
      user: { select: { name: true } },
      product: { select: { name: true, slug: true } },
    },
  });
}
