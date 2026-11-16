"use server";

import { z } from "zod";

import { addToCartSchema, cartQuantitySchema, couponCodeSchema } from "@/lib/schemas/checkout";
import { formatStoreMoney, getCartIdentity } from "@/server/cart-session";
import { db } from "@/server/db";
import { enforceRateLimit } from "@/server/rate-limit";
import {
  type CartView,
  addToCart,
  applyCoupon,
  loadCart,
  removeCartItem,
  removeCoupon,
  setCartItemQuantity,
} from "@/server/services/cart";

import { publicAction } from "./safe-action";

async function view(): Promise<CartView> {
  const id = await getCartIdentity();
  return loadCart(db, id, { now: new Date(), format: formatStoreMoney, email: id.email });
}

export const getCartAction = publicAction(z.object({}), () => view());

export const addToCartAction = publicAction(addToCartSchema, async (input) => {
  const id = await getCartIdentity({ create: true });
  const res = await addToCart(db, id, input);
  const cart = await view();
  return { cart, capped: res.capped };
});

export const updateCartItemAction = publicAction(cartQuantitySchema, async (input) => {
  await setCartItemQuantity(db, await getCartIdentity(), input);
  return view();
});

export const removeCartItemAction = publicAction(
  z.object({ itemId: z.string() }),
  async (input) => {
    await removeCartItem(db, await getCartIdentity(), input.itemId);
    return view();
  },
);

export const applyCouponAction = publicAction(couponCodeSchema, async (input) => {
  await enforceRateLimit("coupon");
  const id = await getCartIdentity();
  await applyCoupon(db, id, {
    code: input.code,
    now: new Date(),
    format: formatStoreMoney,
    email: id.email,
  });
  return view();
});

export const removeCouponAction = publicAction(z.object({}), async () => {
  await removeCoupon(db, await getCartIdentity());
  return view();
});
