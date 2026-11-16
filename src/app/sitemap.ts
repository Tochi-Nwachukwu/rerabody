import type { MetadataRoute } from "next";
import { cacheLife, cacheTag } from "next/cache";

import { absoluteUrl } from "@/lib/site";
import { TAGS } from "@/server/cache-tags";
import { db } from "@/server/db";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  "use cache";
  cacheTag(TAGS.products, TAGS.collections);
  cacheLife("hours");
  const [products, collections, pages] = await Promise.all([
    db.product.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true },
    }),
    db.collection.findMany({ select: { slug: true, updatedAt: true } }),
    db.page.findMany({
      where: { publishedAt: { not: null } },
      select: { slug: true, updatedAt: true },
    }),
  ]);
  return [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/shop"), changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl("/collections"), changeFrequency: "weekly", priority: 0.7 },
    { url: absoluteUrl("/offers"), changeFrequency: "daily", priority: 0.6 },
    { url: absoluteUrl("/faq"), changeFrequency: "monthly", priority: 0.4 },
    { url: absoluteUrl("/contact"), changeFrequency: "yearly", priority: 0.3 },
    ...collections.map((c) => ({
      url: absoluteUrl(`/collections/${c.slug}`),
      lastModified: c.updatedAt,
      priority: 0.8,
    })),
    ...products.map((p) => ({
      url: absoluteUrl(`/products/${p.slug}`),
      lastModified: p.updatedAt,
      priority: 0.8,
    })),
    ...pages.map((p) => ({
      url: absoluteUrl(`/${p.slug}`),
      lastModified: p.updatedAt,
      priority: 0.3,
    })),
  ];
}
