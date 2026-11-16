import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stateless signed links (HMAC with the server secret). Used where a link must
 * be minted later than the order's random guest token is known (emails), and
 * for review and unsubscribe links. Nothing secret is stored.
 */

function secret(): string {
  const s = process.env.BETTER_AUTH_SECRET;
  if (!s) throw new Error("BETTER_AUTH_SECRET is not set");
  return s;
}

function mac(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

/** Returns "expiry.signature". expiresInDays null means no expiry. */
export function signValue(
  purpose: string,
  id: string,
  expiresInDays: number | null = 365,
  now = Date.now(),
): string {
  const exp = expiresInDays === null ? 0 : Math.floor(now / 1000) + expiresInDays * 86400;
  return `${exp}.${mac(`${purpose}:${id}:${exp}`)}`;
}

export function verifySignedValue(
  purpose: string,
  id: string,
  sig: string | null | undefined,
  now = Date.now(),
): boolean {
  if (!sig) return false;
  const [expText, given] = sig.split(".");
  const exp = Number(expText);
  if (!given || !Number.isInteger(exp)) return false;
  if (exp !== 0 && exp < Math.floor(now / 1000)) return false;
  const expected = mac(`${purpose}:${id}:${exp}`);
  return (
    expected.length === given.length && timingSafeEqual(Buffer.from(expected), Buffer.from(given))
  );
}
