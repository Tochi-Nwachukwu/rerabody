import type { PrismaClient } from "@/generated/prisma/client";

/** Minimum word similarity for a fuzzy (misspelt) match on the product name. */
export const FUZZY_THRESHOLD = 0.4;

/**
 * Published product ids matching a query, best first. Full-text matches on
 * name and description rank first; otherwise pg_trgm word similarity on the
 * name catches misspellings ("lavendr buter").
 */
export async function searchProductIds(
  prisma: PrismaClient,
  query: string,
  limit = 48,
): Promise<string[]> {
  const q = query.trim().slice(0, 100);
  if (q.length < 2) return [];
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    WITH query AS (SELECT websearch_to_tsquery('english', ${q}) AS ts)
    SELECT p.id
    FROM "Product" p, query
    WHERE p.status = 'PUBLISHED'
      AND (
        p."searchVector" @@ query.ts
        OR word_similarity(${q}, p.name) >= ${FUZZY_THRESHOLD}
        OR p.name ILIKE '%' || ${q} || '%'
      )
    ORDER BY
      (CASE WHEN p."searchVector" @@ query.ts THEN 1 + ts_rank(p."searchVector", query.ts) ELSE 0 END)
        + word_similarity(${q}, p.name) DESC,
      p.name ASC
    LIMIT ${limit}`;
  return rows.map((r) => r.id);
}
