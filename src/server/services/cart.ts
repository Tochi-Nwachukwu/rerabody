import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { UserError } from "@/server/errors";
import { variantLabel } from "@/lib/variants";

import { validateCoupon } from "./coupons";
import { type PricedLine, computeTotals } from "./pricing";

type Db = PrismaClient | Prisma.TransactionClient;

export type CartIdentity = { userId: string | null; guestToken: string | null };

export const MAX_LINE_QUANTITY = 20;

export type CartLineView = {
  id: string;
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  variantLabel: string;
  image: { url: string; alt: string | null } | null;
  unitPrice: number;
  compareAtPrice: number | null;
  quantity: number;
  lineTotal: number;
  maxQuantity: number;
};

export type CartView = {
  id: string | null;
  lines: CartLineView[];
  count: number;
  subtotal: number;
  discountTotal: number;
  total: number;
  coupon: { code: string; discount: number } | null;
  notices: string[];
};

export const EMPTY_CART: CartView = {
  id: null,
  lines: [],
  count: 0,
  subtotal: 0,
  discountTotal: 0,
  total: 0,
  coupon: null,
  notices: [],
};

const cartInclude = {
  coupon: true,
  items: {
    orderBy: { createdAt: "asc" },
    include: {
      variant: {
        include: {
          image: { select: { url: true, alt: true } },
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
              categoryId: true,
              images: {
                orderBy: [{ isCover: "desc" }, { position: "asc" }],
                take: 1,
                include: { media: { select: { url: true, alt: true } } },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

export async function findCart(db: Db, id: CartIdentity) {
  if (id.userId) return db.cart.findUnique({ where: { userId: id.userId }, include: cartInclude });
  if (id.guestToken)
    return db.cart.findUnique({ where: { guestToken: id.guestToken }, include: cartInclude });
  return null;
}

async function getOrCreateCartId(db: Db, id: CartIdentity): Promise<string> {
  if (id.userId) {
    const cart = await db.cart.upsert({
      where: { userId: id.userId },
      update: {},
      create: { userId: id.userId },
      select: { id: true },
    });
    return cart.id;
  }
  if (!id.guestToken) throw new Error("A guest cart needs a token");
  const cart = await db.cart.upsert({
    where: { guestToken: id.guestToken },
    update: {},
    create: { guestToken: id.guestToken },
    select: { id: true },
  });
  return cart.id;
}

async function purchasableVariant(db: Db, variantId: string) {
  const v = await db.productVariant.findUnique({
    where: { id: variantId },
    select: {
      id: true,
      price: true,
      stock: true,
      isActive: true,
      product: { select: { status: true, name: true } },
    },
  });
  if (!v || !v.isActive || v.product.status !== "PUBLISHED")
    throw new UserError("This item is no longer available.");
  return v;
}

export async function addToCart(
  db: Db,
  id: CartIdentity,
  input: { variantId: string; quantity: number },
) {
  const variant = await purchasableVariant(db, input.variantId);
  if (variant.stock <= 0) throw new UserError("Sorry, this is sold out.");
  const cartId = await getOrCreateCartId(db, id);
  const existing = await db.cartItem.findUnique({
    where: { cartId_variantId: { cartId, variantId: variant.id } },
  });
  const limit = Math.min(variant.stock, MAX_LINE_QUANTITY);
  const wanted = (existing?.quantity ?? 0) + input.quantity;
  const quantity = Math.min(wanted, limit);
  if (existing && existing.quantity >= limit)
    throw new UserError(`You already have the maximum available (${limit}) in your cart.`);
  await db.cartItem.upsert({
    where: { cartId_variantId: { cartId, variantId: variant.id } },
    update: { quantity, lastSeenPrice: variant.price },
    create: { cartId, variantId: variant.id, quantity, lastSeenPrice: variant.price },
  });
  await db.cart.update({
    where: { id: cartId },
    data: { updatedAt: new Date(), abandonedEmailSentAt: null },
  });
  return { capped: quantity < wanted, quantity };
}

async function ownedItem(db: Db, id: CartIdentity, itemId: string) {
  const cart = await findCart(db, id);
  const item = cart?.items.find((i) => i.id === itemId);
  if (!cart || !item) throw new UserError("That item is no longer in your cart.");
  return { cart, item };
}

export async function setCartItemQuantity(
  db: Db,
  id: CartIdentity,
  input: { itemId: string; quantity: number },
) {
  const { item } = await ownedItem(db, id, input.itemId);
  if (input.quantity <= 0) {
    await db.cartItem.delete({ where: { id: item.id } });
    return;
  }
  const limit = Math.min(item.variant.stock, MAX_LINE_QUANTITY);
  if (limit <= 0) throw new UserError("Sorry, this is sold out.");
  await db.cartItem.update({
    where: { id: item.id },
    data: { quantity: Math.min(input.quantity, limit) },
  });
}

export async function removeCartItem(db: Db, id: CartIdentity, itemId: string) {
  const { item } = await ownedItem(db, id, itemId);
  await db.cartItem.delete({ where: { id: item.id } });
}

function toPricedLines(
  lines: CartLineView[],
  categoryOf: Map<string, string | null>,
): PricedLine[] {
  return lines.map((l) => ({
    productId: l.productId,
    categoryId: categoryOf.get(l.productId) ?? null,
    unitPrice: l.unitPrice,
    quantity: l.quantity,
  }));
}

/**
 * Loads the cart and revalidates every line against the database: removed
 * or unpublished items are dropped, quantities are capped at stock, and price
 * changes are flagged. The coupon is re-checked too. Changes are saved.
 */
export async function loadCart(
  db: Db,
  id: CartIdentity,
  opts: { now: Date; format: (n: number) => string; email?: string | null },
): Promise<CartView> {
  const cart = await findCart(db, id);
  if (!cart) return EMPTY_CART;

  const notices: string[] = [];
  const lines: CartLineView[] = [];
  const categoryOf = new Map<string, string | null>();

  for (const item of cart.items) {
    const v = item.variant;
    const label = variantLabel(v.optionValues as Record<string, string>);
    const name = `${v.product.name}${label === "Default" ? "" : ` (${label})`}`;
    if (!v.isActive || v.product.status !== "PUBLISHED") {
      await db.cartItem.delete({ where: { id: item.id } });
      notices.push(`${name} is no longer available and was removed.`);
      continue;
    }
    const limit = Math.min(v.stock, MAX_LINE_QUANTITY);
    if (limit <= 0) {
      await db.cartItem.delete({ where: { id: item.id } });
      notices.push(`${name} sold out and was removed.`);
      continue;
    }
    let quantity = item.quantity;
    if (quantity > limit) {
      quantity = limit;
      await db.cartItem.update({ where: { id: item.id }, data: { quantity } });
      notices.push(
        `Only ${limit} of ${name} ${limit === 1 ? "is" : "are"} available, so we updated the quantity.`,
      );
    }
    if (item.lastSeenPrice !== v.price) {
      notices.push(
        `The price of ${name} changed from ${opts.format(item.lastSeenPrice)} to ${opts.format(v.price)}.`,
      );
      await db.cartItem.update({ where: { id: item.id }, data: { lastSeenPrice: v.price } });
    }
    categoryOf.set(v.product.id, v.product.categoryId);
    const image = v.image ?? v.product.images[0]?.media ?? null;
    lines.push({
      id: item.id,
      variantId: v.id,
      productId: v.product.id,
      productName: v.product.name,
      productSlug: v.product.slug,
      variantLabel: label,
      image: image ? { url: image.url, alt: image.alt } : null,
      unitPrice: v.price,
      compareAtPrice: v.compareAtPrice && v.compareAtPrice > v.price ? v.compareAtPrice : null,
      quantity,
      lineTotal: v.price * quantity,
      maxQuantity: limit,
    });
  }

  let discount = 0;
  let coupon: CartView["coupon"] = null;
  if (cart.coupon) {
    const { result } = await validateCoupon(
      db,
      cart.coupon.code,
      toPricedLines(lines, categoryOf),
      { userId: cart.userId, email: opts.email ?? cart.email },
      opts.now,
      opts.format,
    );
    if (result.ok) {
      discount = result.discount;
      coupon = { code: cart.coupon.code, discount };
    } else {
      await db.cart.update({ where: { id: cart.id }, data: { couponId: null } });
      if (lines.length) notices.push(`Code ${cart.coupon.code} was removed: ${result.reason}`);
    }
  }

  const totals = computeTotals(toPricedLines(lines, categoryOf), discount, 0);
  return {
    id: cart.id,
    lines,
    count: lines.reduce((n, l) => n + l.quantity, 0),
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    total: totals.total,
    coupon,
    notices,
  };
}

export async function applyCoupon(
  db: Db,
  id: CartIdentity,
  input: { code: string; now: Date; format: (n: number) => string; email?: string | null },
) {
  const cart = await findCart(db, id);
  if (!cart || cart.items.length === 0) throw new UserError("Add something to your cart first.");
  const view = await loadCart(db, id, { now: input.now, format: input.format, email: input.email });
  const categories = new Map(
    cart.items.map((i) => [i.variant.product.id, i.variant.product.categoryId]),
  );
  const lines = view.lines.map((l) => ({
    productId: l.productId,
    categoryId: categories.get(l.productId) ?? null,
    unitPrice: l.unitPrice,
    quantity: l.quantity,
  }));
  const { coupon, result } = await validateCoupon(
    db,
    input.code,
    lines,
    { userId: cart.userId, email: input.email ?? cart.email },
    input.now,
    input.format,
  );
  if (!coupon || !result.ok)
    throw new UserError(result.ok ? "We do not recognise that code." : result.reason);
  await db.cart.update({ where: { id: cart.id }, data: { couponId: coupon.id } });
}

export async function removeCoupon(db: Db, id: CartIdentity) {
  const cart = await findCart(db, id);
  if (cart) await db.cart.update({ where: { id: cart.id }, data: { couponId: null } });
}

/**
 * Moves a guest cart into the user's cart on sign in. Quantities add up and
 * are capped at stock; the guest coupon carries over if the user has none.
 */
export async function mergeGuestCart(db: PrismaClient, guestToken: string, userId: string) {
  await db.$transaction(async (tx) => {
    const guest = await tx.cart.findUnique({
      where: { guestToken },
      include: { items: { include: { variant: { select: { stock: true } } } } },
    });
    if (!guest || guest.userId === userId) return;
    const userCart = await tx.cart.upsert({
      where: { userId },
      update: {},
      create: { userId },
      include: { items: true },
    });
    for (const item of guest.items) {
      const existing = userCart.items.find((i) => i.variantId === item.variantId);
      const limit = Math.min(item.variant.stock, MAX_LINE_QUANTITY);
      const quantity = Math.min(
        (existing?.quantity ?? 0) + item.quantity,
        Math.max(limit, existing?.quantity ?? 0),
      );
      if (quantity <= 0) continue;
      await tx.cartItem.upsert({
        where: { cartId_variantId: { cartId: userCart.id, variantId: item.variantId } },
        update: { quantity },
        create: {
          cartId: userCart.id,
          variantId: item.variantId,
          quantity,
          lastSeenPrice: item.lastSeenPrice,
        },
      });
    }
    if (!userCart.couponId && guest.couponId) {
      await tx.cart.update({ where: { id: userCart.id }, data: { couponId: guest.couponId } });
    }
    await tx.cart.delete({ where: { id: guest.id } });
  });
}
