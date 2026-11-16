/** Fixed brand values used where the database is not available (emails, metadata fallbacks). */
export const STORE_NAME = "Rera Body";

export function absoluteUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
