export const CART_COOKIE = "rb_cart";

export function readCartCookie(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === CART_COOKIE) return decodeURIComponent(v.join("="));
  }
  return null;
}
