import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Random URL-safe token. Only its hash is stored (rule 12). */
export function generateToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function tokenMatchesHash(token: string, hash: string | null | undefined): boolean {
  if (!hash) return false;
  const a = Buffer.from(hashToken(token));
  const b = Buffer.from(hash);
  return a.length === b.length && timingSafeEqual(a, b);
}
