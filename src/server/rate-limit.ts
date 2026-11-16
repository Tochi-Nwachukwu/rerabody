import "server-only";

import { headers } from "next/headers";

import { db } from "@/server/db";
import { UserError } from "@/server/errors";

import { hitRateLimit } from "./rate-limit-core";

export const LIMITS = {
  contact: { max: 5, windowSeconds: 600 },
  newsletter: { max: 5, windowSeconds: 600 },
  coupon: { max: 10, windowSeconds: 60 },
  review: { max: 5, windowSeconds: 600 },
  orderLookup: { max: 10, windowSeconds: 600 },
} as const;

async function clientIp(): Promise<string> {
  const h = await headers();
  // Vercel sets x-forwarded-for; the first address is the client.
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

/** Throws a friendly error when this client has used up its allowance for the action. */
export async function enforceRateLimit(action: keyof typeof LIMITS, extraKey?: string) {
  const key = `app:${action}:${await clientIp()}${extraKey ? `:${extraKey}` : ""}`;
  const { allowed } = await hitRateLimit(db, key, LIMITS[action]);
  if (!allowed) throw new UserError("Too many attempts. Please wait a few minutes and try again.");
}
