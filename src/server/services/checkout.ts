import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { AddressData } from "@/lib/schemas/checkout";
import { variantLabel } from "@/lib/variants";
import { UserError } from "@/server/errors";
import type { PaymentProvider } from "@/server/payments/types";
import { generateToken, hashToken, tokenMatchesHash } from "@/server/tokens";

import { type CartIdentity, findCart } from "./cart";
import { validateCoupon } from "./coupons";
import { transitionOrder } from "./order-status";
import { type PricedLine, computeTotals } from "./pricing";

export type CreateOrderInput = {
  identity: CartIdentity;
  userId: string | null;
  email: string;
  address: AddressData;
  shippingMethodId: string;
  saveAddress: boolean;
  currency: string;
  appUrl: string;
  now: Date;
  format: (n: number) => string;
};

async function nextOrderNumber(tx: Prisma.TransactionClient) {
  const [row] = await tx.$queryRaw<{ n: bigint }[]>`SELECT nextval('order_number_seq') AS n`;
  return `RB-${row.n}`;
}

/**
 * S9 "Pay now". Recomputes every price, discount and total from the database
 * (rule 7), re-validates the coupon (rule 8), creates the PENDING_PAYMENT
 * order and starts a hosted checkout. Only variant ids, quantities, the coupon
 * code, the address and the shipping method id come from the customer.
 */
export async function createOrderFromCart(
  prisma: PrismaClient,
  provider: PaymentProvider,
  input: CreateOrderInput,
) {
  const cart = await findCart(prisma, input.identity);
  if (!cart || cart.items.length === 0) throw new UserError("Your cart is empty.");

  const shipping = await prisma.shippingMethod.findUnique({
    where: { id: input.shippingMethodId },
  });
  if (!shipping || !shipping.isActive)
    throw new UserError("That delivery option is no longer available. Please choose another.");

  const problems: string[] = [];
  const lines = cart.items.map((item) => {
    const v = item.variant;
    const label = variantLabel(v.optionValues as Record<string, string>);
    if (!v.isActive || v.product.status !== "PUBLISHED")
      problems.push(`${v.product.name} is no longer available.`);
    else if (v.stock < item.quantity)
      problems.push(
        v.stock === 0
          ? `${v.product.name} (${label}) sold out.`
          : `Only ${v.stock} of ${v.product.name} (${label}) left.`,
      );
    const image = v.image ?? v.product.images[0]?.media ?? null;
    return {
      variantId: v.id,
      productId: v.product.id,
      categoryId: v.product.categoryId,
      productName: v.product.name,
      variantLabel: label,
      sku: v.sku,
      imageUrl: image?.url ?? null,
      unitPrice: v.price,
      quantity: item.quantity,
    };
  });
  if (problems.length)
    throw new UserError(`Your cart changed: ${problems.join(" ")} Please review your cart.`);

  const priced: PricedLine[] = lines.map((l) => ({
    productId: l.productId,
    categoryId: l.categoryId,
    unitPrice: l.unitPrice,
    quantity: l.quantity,
  }));
  let discount = 0;
  let couponCode: string | null = null;
  if (cart.coupon) {
    const { result } = await validateCoupon(
      prisma,
      cart.coupon.code,
      priced,
      { userId: input.userId, email: input.email },
      input.now,
      input.format,
    );
    if (!result.ok) {
      await prisma.cart.update({ where: { id: cart.id }, data: { couponId: null } });
      throw new UserError(`Code ${cart.coupon.code} no longer applies: ${result.reason}`);
    }
    discount = result.discount;
    couponCode = cart.coupon.code;
  }
  const totals = computeTotals(priced, discount, shipping.price);

  const guestToken = generateToken();
  const order = await prisma.$transaction(async (tx) => {
    const number = await nextOrderNumber(tx);
    const created = await tx.order.create({
      data: {
        number,
        userId: input.userId,
        email: input.email,
        status: "PENDING_PAYMENT",
        ...totals,
        currency: input.currency,
        couponCode,
        shippingAddress: input.address,
        shippingMethod: {
          id: shipping.id,
          name: shipping.name,
          price: shipping.price,
          estimate: shipping.estimate,
          region: shipping.region,
        },
        guestAccessTokenHash: hashToken(guestToken),
        sourceCartId: cart.id,
        items: {
          create: lines.map((l) => ({
            variantId: l.variantId,
            productId: l.productId,
            productName: l.productName,
            variantLabel: l.variantLabel,
            sku: l.sku,
            imageUrl: l.imageUrl,
            unitPrice: l.unitPrice,
            quantity: l.quantity,
            lineTotal: l.unitPrice * l.quantity,
          })),
        },
        statusEvents: {
          create: { fromStatus: null, toStatus: "PENDING_PAYMENT", note: "Checkout started" },
        },
      },
    });
    await tx.cart.update({ where: { id: cart.id }, data: { email: input.email } });
    if (input.saveAddress && input.userId) {
      const hasDefault = await tx.address.count({
        where: { userId: input.userId, isDefault: true },
      });
      await tx.address.create({
        data: {
          ...input.address,
          line2: input.address.line2 ?? null,
          state: input.address.state ?? null,
          postalCode: input.address.postalCode ?? null,
          userId: input.userId,
          isDefault: hasDefault === 0,
        },
      });
    }
    return created;
  });

  const base = input.appUrl.replace(/\/$/, "");
  const access = `order=${order.id}&token=${guestToken}`;
  const absolute = (url: string | null) => (url && url.startsWith("/") ? `${base}${url}` : url);
  try {
    const session = await provider.createCheckout({
      orderId: order.id,
      orderNumber: order.number,
      email: input.email,
      currency: input.currency,
      lines: lines.map((l) => ({
        name: l.variantLabel === "Default" ? l.productName : `${l.productName} (${l.variantLabel})`,
        unitAmount: l.unitPrice,
        quantity: l.quantity,
        imageUrl: absolute(l.imageUrl),
      })),
      shipping: { name: shipping.name, amount: shipping.price },
      discount: discount > 0 ? { amount: discount, label: `Code ${couponCode}` } : null,
      successUrl: `${base}/checkout/success?${access}&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${base}/checkout/cancelled?${access}`,
    });
    await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: provider.name,
        providerSessionId: session.sessionId,
        amount: order.total,
        status: "PENDING",
      },
    });
    return { orderId: order.id, number: order.number, url: session.url, guestToken };
  } catch (error) {
    await prisma.$transaction((tx) =>
      transitionOrder(tx, {
        orderId: order.id,
        to: "CANCELLED",
        actorId: null,
        note: "Could not start payment",
      }),
    );
    console.error("[checkout] could not create payment session", error);
    throw new UserError("We could not start the payment. Please try again in a moment.");
  }
}

/** Finds an order for a guest token or the signed-in owner. Returns null when access is not allowed. */
export async function findOrderForViewer(
  prisma: PrismaClient,
  input: { orderId: string; token?: string | null; userId?: string | null },
) {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { items: true },
  });
  if (!order) return null;
  const tokenOk = !!input.token && tokenMatchesHash(input.token, order.guestAccessTokenHash);
  const ownerOk = !!input.userId && order.userId === input.userId;
  return tokenOk || ownerOk ? order : null;
}
