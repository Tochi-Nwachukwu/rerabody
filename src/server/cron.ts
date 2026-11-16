import { timingSafeEqual } from "node:crypto";

/**
 * Cron routes accept `Authorization: Bearer <CRON_SECRET>` (what Vercel Cron
 * sends) or `x-cron-secret: <CRON_SECRET>`. Constant-time comparison.
 */
export function isAuthorisedCron(headers: Headers, secret: string): boolean {
  const bearer = headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const given = bearer || headers.get("x-cron-secret") || "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
