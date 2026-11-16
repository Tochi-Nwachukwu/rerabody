import type { OrderStatus, Prisma, PrismaClient } from "@/generated/prisma/client";
import { UserError } from "@/server/errors";
import type { PaymentProvider } from "@/server/payments/types";

import { audit } from "./audit";
import { transitionOrder } from "./order-status";

/** Moves staff can make with the status buttons. Cancel and refund have their own flows. */
export const FULFILMENT_STATUSES = [
  "PROCESSING",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
] as const;
export type FulfilmentStatus = (typeof FULFILMENT_STATUSES)[number];

export async function updateFulfilmentStatus(
  prisma: PrismaClient,
  input: {
    orderId: string;
    to: FulfilmentStatus;
    actorId: string;
    note?: string | null;
    carrier?: string | null;
    trackingNumber?: string | null;
  },
) {
  return prisma.$transaction(async (tx) => {
    const data: Prisma.OrderUpdateManyMutationInput = {};
    if (input.to === "SHIPPED") {
      if (!input.carrier?.trim() || !input.trackingNumber?.trim())
        throw new UserError("Enter the carrier and tracking number.");
      data.trackingCarrier = input.carrier.trim();
      data.trackingNumber = input.trackingNumber.trim();
    }
    const move = await transitionOrder(tx, {
      orderId: input.orderId,
      to: input.to,
      actorId: input.actorId,
      note: input.note ?? null,
      data,
    });
    await audit(tx, {
      actorId: input.actorId,
      action: "order.status",
      targetType: "Order",
      targetId: input.orderId,
      before: { status: move.from },
      after: { status: move.to, ...data },
    });
    return move;
  });
}

export async function updateTracking(
  prisma: PrismaClient,
  input: { orderId: string; carrier: string; trackingNumber: string; actorId: string },
) {
  const before = await prisma.order.findUnique({
    where: { id: input.orderId },
    select: { trackingCarrier: true, trackingNumber: true },
  });
  if (!before) throw new UserError("This order no longer exists.");
  const after = await prisma.order.update({
    where: { id: input.orderId },
    data: { trackingCarrier: input.carrier.trim(), trackingNumber: input.trackingNumber.trim() },
    select: { trackingCarrier: true, trackingNumber: true },
  });
  await audit(prisma, {
    actorId: input.actorId,
    action: "order.tracking",
    targetType: "Order",
    targetId: input.orderId,
    before,
    after,
  });
}

async function restockOrder(
  tx: Prisma.TransactionClient,
  orderId: string,
  number: string,
  actorId: string,
) {
  const already = await tx.inventoryMovement.count({ where: { orderId, reason: "REFUND" } });
  if (already > 0) return false;
  const sold = await tx.inventoryMovement.findMany({ where: { orderId, reason: "SALE" } });
  for (const m of sold) {
    await tx.productVariant.update({
      where: { id: m.variantId },
      data: { stock: { increment: -m.delta } },
    });
    await tx.inventoryMovement.create({
      data: {
        variantId: m.variantId,
        delta: -m.delta,
        reason: "REFUND",
        orderId,
        note: `Returned from order ${number}`,
        actorId,
      },
    });
  }
  return sold.length > 0;
}

function paidPayment(order: {
  payments: {
    status: string;
    amount: number;
    refundedAmount: number;
    providerPaymentId: string | null;
    provider: string;
    id: string;
  }[];
}) {
  return (
    order.payments.find(
      (p) =>
        p.status === "SUCCEEDED" || p.status === "PARTIALLY_REFUNDED" || p.status === "REFUNDED",
    ) ?? null
  );
}

/**
 * Refunds part or all of the payment through the provider, then records it.
 * A full refund moves the order to REFUNDED. Restocking returns the sold units once.
 */
export async function refundOrder(
  prisma: PrismaClient,
  provider: (name: string) => PaymentProvider,
  input: {
    orderId: string;
    amount: number;
    restock: boolean;
    reason: string | null;
    actorId: string;
  },
) {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { payments: true },
  });
  if (!order) throw new UserError("This order no longer exists.");
  const payment = paidPayment(order);
  if (!payment || !payment.providerPaymentId)
    throw new UserError("This order has no captured payment to refund.");
  const refundable = payment.amount - payment.refundedAmount;
  if (input.amount <= 0 || input.amount > refundable)
    throw new UserError(`You can refund up to ${refundable} (minor units).`);
  if (order.status === "REFUNDED" || order.status === "PENDING_PAYMENT")
    throw new UserError("This order cannot be refunded.");

  const refund = await provider(payment.provider).refund({
    paymentId: payment.providerPaymentId,
    amount: input.amount,
    idempotencyKey: `refund-${order.id}-${payment.refundedAmount}-${input.amount}`,
  });

  const full = payment.refundedAmount + input.amount >= payment.amount;
  const result = await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        refundedAmount: { increment: input.amount },
        status: full ? "REFUNDED" : "PARTIALLY_REFUNDED",
      },
    });
    let restocked = false;
    if (input.restock) restocked = await restockOrder(tx, order.id, order.number, input.actorId);
    const note = `Refunded ${input.amount}${input.reason ? `: ${input.reason}` : ""}${restocked ? ". Items returned to stock." : ""}`;
    if (full && order.status !== "CANCELLED") {
      await transitionOrder(tx, {
        orderId: order.id,
        to: "REFUNDED",
        actorId: input.actorId,
        note,
      });
    } else {
      await tx.orderNote.create({
        data: { orderId: order.id, authorId: input.actorId, body: note },
      });
    }
    await audit(tx, {
      actorId: input.actorId,
      action: "order.refund",
      targetType: "Order",
      targetId: order.id,
      after: { amount: input.amount, refundId: refund.refundId, full, restocked },
    });
    return { refundId: refund.refundId, full, restocked };
  });
  return result;
}

/**
 * Cancels an order. Unpaid orders just cancel. Paid orders are refunded in
 * full first (money taken must go back), and items can be returned to stock.
 */
export async function cancelOrder(
  prisma: PrismaClient,
  provider: (name: string) => PaymentProvider,
  input: { orderId: string; restock: boolean; reason: string | null; actorId: string },
) {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { payments: true },
  });
  if (!order) throw new UserError("This order no longer exists.");
  if (!["PENDING_PAYMENT", "PAID", "PROCESSING"].includes(order.status)) {
    throw new UserError(
      "Only orders that have not shipped can be cancelled. Use a refund instead.",
    );
  }
  const payment = paidPayment(order);
  let refund: { refundId: string; amount: number } | null = null;
  if (payment && payment.providerPaymentId && payment.amount > payment.refundedAmount) {
    const amount = payment.amount - payment.refundedAmount;
    const r = await provider(payment.provider).refund({
      paymentId: payment.providerPaymentId,
      amount,
      idempotencyKey: `cancel-${order.id}`,
    });
    refund = { refundId: r.refundId, amount };
  }
  await prisma.$transaction(async (tx) => {
    if (refund && payment) {
      await tx.payment.update({
        where: { id: payment.id },
        data: { refundedAmount: { increment: refund.amount }, status: "REFUNDED" },
      });
    }
    const restocked =
      input.restock && order.status !== "PENDING_PAYMENT"
        ? await restockOrder(tx, order.id, order.number, input.actorId)
        : false;
    await transitionOrder(tx, {
      orderId: order.id,
      to: "CANCELLED",
      actorId: input.actorId,
      note:
        [
          input.reason,
          refund ? `Refunded ${refund.amount}` : null,
          restocked ? "Items returned to stock" : null,
        ]
          .filter(Boolean)
          .join(". ") || null,
    });
    await audit(tx, {
      actorId: input.actorId,
      action: "order.cancel",
      targetType: "Order",
      targetId: order.id,
      before: { status: order.status },
      after: { status: "CANCELLED", refund, restocked },
    });
  });
  return { refund };
}

export async function addOrderNote(
  prisma: PrismaClient,
  input: { orderId: string; body: string; actorId: string },
) {
  const note = await prisma.orderNote.create({
    data: { orderId: input.orderId, authorId: input.actorId, body: input.body.trim() },
  });
  await audit(prisma, {
    actorId: input.actorId,
    action: "order.note",
    targetType: "Order",
    targetId: input.orderId,
    after: { body: note.body },
  });
  return note;
}

export async function clearManualReview(
  prisma: PrismaClient,
  input: { orderId: string; actorId: string },
) {
  await prisma.order.update({ where: { id: input.orderId }, data: { needsManualReview: false } });
  await audit(prisma, {
    actorId: input.actorId,
    action: "order.review-cleared",
    targetType: "Order",
    targetId: input.orderId,
  });
}

export const ORDER_PAGE_SIZE = 25;

export async function listOrdersAdmin(
  prisma: PrismaClient,
  input: {
    q?: string;
    status?: OrderStatus;
    review?: boolean;
    from?: Date;
    to?: Date;
    page?: number;
  },
) {
  const page = Math.max(1, input.page ?? 1);
  const where: Prisma.OrderWhereInput = {
    ...(input.status ? { status: input.status } : { status: { not: "PENDING_PAYMENT" } }),
    ...(input.review ? { needsManualReview: true } : {}),
    ...(input.from || input.to
      ? {
          createdAt: {
            ...(input.from ? { gte: input.from } : {}),
            ...(input.to ? { lt: input.to } : {}),
          },
        }
      : {}),
    ...(input.q
      ? {
          OR: [
            { number: { contains: input.q, mode: "insensitive" } },
            { email: { contains: input.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ORDER_PAGE_SIZE,
      take: ORDER_PAGE_SIZE,
      select: {
        id: true,
        number: true,
        email: true,
        status: true,
        total: true,
        currency: true,
        createdAt: true,
        needsManualReview: true,
        shippingAddress: true,
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);
  return { items, total, page, pageCount: Math.max(1, Math.ceil(total / ORDER_PAGE_SIZE)) };
}

export async function getOrderAdmin(prisma: PrismaClient, id: string) {
  return prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      user: { select: { id: true, name: true, email: true } },
      statusEvents: {
        orderBy: { createdAt: "asc" },
        include: { actor: { select: { name: true } } },
      },
      notes: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } },
      payments: { orderBy: { createdAt: "asc" } },
      couponRedemption: true,
    },
  });
}
