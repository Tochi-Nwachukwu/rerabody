import "server-only";

import { cookies } from "next/headers";

import { env } from "@/env";
import { formatMoney } from "@/lib/money";
import { getSession } from "@/server/auth/session";
import type { CartIdentity } from "@/server/services/cart";
import { generateToken } from "@/server/tokens";

import { CART_COOKIE } from "@/server/cart-cookie";

/** Reads who owns the cart: the signed-in user, else the guest cookie. */
export async function getCartIdentity(
  opts: { create?: boolean } = {},
): Promise<CartIdentity & { email: string | null }> {
  const session = await getSession();
  if (session) return { userId: session.user.id, guestToken: null, email: session.user.email };
  const jar = await cookies();
  let token = jar.get(CART_COOKIE)?.value ?? null;
  if (!token && opts.create) {
    token = generateToken();
    // Only Server Actions and route handlers can set cookies; callers pass create: true there.
    jar.set(CART_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 60,
    });
  }
  return { userId: null, guestToken: token, email: null };
}

export const formatStoreMoney = (n: number) => formatMoney(n, env.STORE_CURRENCY);
