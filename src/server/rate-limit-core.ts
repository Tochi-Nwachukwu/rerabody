import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Fixed-window counter in the RateLimit table (shared with Better Auth, whose
 * keys never start with "app:"). One atomic upsert per call.
 */
export async function hitRateLimit(
  prisma: PrismaClient,
  key: string,
  limit: { max: number; windowSeconds: number },
  now = Date.now(),
) {
  const windowStart = BigInt(now - limit.windowSeconds * 1000);
  const id = `app_${key}`.slice(0, 190);
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("id", "key", "count", "lastRequest")
    VALUES (${id}, ${key}, 1, ${BigInt(now)})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."lastRequest" < ${windowStart} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "lastRequest" = CASE WHEN "RateLimit"."lastRequest" < ${windowStart} THEN ${BigInt(now)} ELSE "RateLimit"."lastRequest" END
    RETURNING "count"`;
  const count = rows[0]?.count ?? 1;
  return { allowed: count <= limit.max, count };
}
