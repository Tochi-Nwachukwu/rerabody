import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { TAGS } from "@/server/cache-tags";
import { db } from "@/server/db";

export async function getPublishedPage(slug: string) {
  "use cache";
  cacheTag(TAGS.page(slug));
  cacheLife("max");
  const page = await db.page.findUnique({ where: { slug } });
  if (!page || !page.publishedAt || !page.body) return null;
  return {
    slug: page.slug,
    title: page.title,
    body: page.body,
    metaTitle: page.metaTitle,
    metaDescription: page.metaDescription,
    updatedAt: page.updatedAt.toISOString(),
  };
}

export async function getFaqs() {
  "use cache";
  cacheTag(TAGS.faq);
  cacheLife("max");
  return db.faq.findMany({
    orderBy: [{ position: "asc" }],
    select: { id: true, topic: true, question: true, answer: true },
  });
}
