import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { isUniqueConstraintError } from "@/server/errors";
import type { PaymentEvent } from "@/server/payments/types";

import { transitionOrder } from "./order-status";

export type WebhookOutcome =
  | { status: "duplicate" }
  | { status: "ignored"; reason: string }
  | {
      status: "paid";
      orderId: string;
      needsReview: boolean;
      reasons: string[];
      productIds: string[];
    }
  | { status: "cancelled"; orderId: string };

/**
 * Applies one verified payment event (rules 1 to 3).
 *
 * The ProcessedWebhookEvent insert runs first inside the same transaction as
 * the handling, so a duplicate delivery hits the unique constraint and does
 * nothing, and a delivery whose handling fails is rolled back and can be retried.
 * The order becomes PAID only here.
 */
export async function handlePaymentEvent(
  prisma: PrismaClient,
  provider: string,
  event: PaymentEvent,
  now = new Date(),
): Promise<WebhookOutcome> {
  try {
    return await prisma.$transaction(
      async (tx) => {
        await tx.processedWebhookEvent.create({ data: { provider, eventId: event.eventId } });
        switch (event.kind) {
          case "checkout.completed":
            return markPaid(tx, event, now);
          case "checkout.expired":
            return cancelUnpaid(tx, event.sessionId, "EXPIRED", "Payment session expired");
          case "checkout.failed":
            return cancelUnpaid(tx, event.sessionId, "FAILED", "Payment failed");
          default:
            return { status: "ignored" as const, reason: `Unhandled event ${event.type}` };
        }
      },
      { timeout: 20_000 },
    );
  } catch (error) {
    if (
      isUniqueConstraintError(error) &&
      JSON.stringify((error as { meta?: unknown }).meta ?? "").includes("ProcessedWebhookEvent")
    ) {
      return { status: "duplicate" };
    }
    throw error;
  }
}

async function markPaid(
  tx: Prisma.TransactionClient,
  event: Extract<PaymentEvent, { kind: "checkout.completed" }>,
  now: Date,
): Promise<WebhookOutcome> {
  const payment = await tx.payment.findUnique({
    where: { providerSessionId: event.sessionId },
    include: { order: { include: { items: true } } },
  });
  if (!payment) return { status: "ignored", reason: `Unknown checkout session ${event.sessionId}` };
  const order = payment.order;

  // Sales tax is added by the provider at payment, so the order total grows by it.
  const tax = Math.max(0, event.amountTax ?? 0);
  const expectedTotal = order.total + (order.status === "PENDING_PAYMENT" ? tax : 0);

  await tx.payment.update({
    where: { id: payment.id },
    data: {
      status: "SUCCEEDED",
      providerPaymentId: event.paymentId ?? payment.providerPaymentId,
      // Refunds are capped at what was actually charged, tax included.
      ...(event.amountTotal !== null ? { amount: event.amountTotal } : {}),
    },
  });

  if (order.status !== "PENDING_PAYMENT") {
    if (order.status === "CANCELLED") {
      // Money arrived for an order that was already cancelled. Do not auto-refund: flag it.
      await tx.order.update({
        where: { id: order.id },
        data: {
          needsManualReview: true,
          manualReviewReason:
            "Payment received after the order was cancelled. Refund or reinstate manually.",
        },
      });
      return {
        status: "paid",
        orderId: order.id,
        needsReview: true,
        reasons: ["Payment received after cancellation"],
        productIds: [],
      };
    }
    return { status: "ignored", reason: `Order ${order.number} is already ${order.status}` };
  }

  await transitionOrder(tx, {
    orderId: order.id,
    to: "PAID",
    actorId: null,
    note: "Payment confirmed",
    data: { paidAt: now, ...(tax > 0 ? { taxTotal: tax, total: expectedTotal } : {}) },
  });

  const reasons: string[] = [];
  if (event.amountTotal !== null && event.amountTotal !== expectedTotal) {
    reasons.push(
      `Amount paid (${event.amountTotal}) does not match the order total (${expectedTotal}).`,
    );
  }

  // Rule 3: conditional decrement, so stock never goes negative.
  for (const item of order.items) {
    if (!item.variantId) {
      reasons.push(`${item.sku} no longer exists, so stock was not taken.`);
      continue;
    }
    const updated = await tx.productVariant.updateMany({
      where: { id: item.variantId, stock: { gte: item.quantity } },
      data: { stock: { decrement: item.quantity } },
    });
    if (updated.count === 0) {
      reasons.push(`Not enough stock for ${item.sku} (needed ${item.quantity}).`);
      continue;
    }
    await tx.inventoryMovement.create({
      data: {
        variantId: item.variantId,
        delta: -item.quantity,
        reason: "SALE",
        orderId: order.id,
        note: `Order ${order.number}`,
      },
    });
  }

  if (order.couponCode) {
    const coupon = await tx.coupon.findUnique({ where: { code: order.couponCode } });
    if (coupon) {
      await tx.couponRedemption.create({
        data: {
          couponId: coupon.id,
          orderId: order.id,
          userId: order.userId,
          email: order.email.toLowerCase(),
          amount: order.discountTotal,
        },
      });
    }
  }

  if (order.sourceCartId) {
    const variantIds = order.items.map((i) => i.variantId).filter((v): v is string => !!v);
    await tx.cartItem.deleteMany({
      where: { cartId: order.sourceCartId, variantId: { in: variantIds } },
    });
    if (order.couponCode)
      await tx.cart.updateMany({ where: { id: order.sourceCartId }, data: { couponId: null } });
  }

  if (reasons.length) {
    await tx.order.update({
      where: { id: order.id },
      data: { needsManualReview: true, manualReviewReason: reasons.join(" ") },
    });
  }

  return {
    status: "paid",
    orderId: order.id,
    needsReview: reasons.length > 0,
    reasons,
    productIds: [...new Set(order.items.map((i) => i.productId).filter((p): p is string => !!p))],
  };
}

async function cancelUnpaid(
  tx: Prisma.TransactionClient,
  sessionId: string,
  paymentStatus: "EXPIRED" | "FAILED",
  note: string,
): Promise<WebhookOutcome> {
  const payment = await tx.payment.findUnique({
    where: { providerSessionId: sessionId },
    include: { order: { select: { id: true, status: true } } },
  });
  if (!payment) return { status: "ignored", reason: `Unknown checkout session ${sessionId}` };
  if (payment.status === "PENDING")
    await tx.payment.update({ where: { id: payment.id }, data: { status: paymentStatus } });
  if (payment.order.status !== "PENDING_PAYMENT")
    return { status: "ignored", reason: "Order is not awaiting payment" };
  await transitionOrder(tx, { orderId: payment.order.id, to: "CANCELLED", actorId: null, note });
  return { status: "cancelled", orderId: payment.order.id };
}
