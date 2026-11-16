"use server";

import { z } from "zod";

import { TAGS, expireTags } from "@/server/cache-tags";
import { db } from "@/server/db";
import { UserError } from "@/server/errors";
import { notifyOrderStatus, notifyRefund } from "@/server/notifications/orders";
import { getProviderByName } from "@/server/payments";
import {
  FULFILMENT_STATUSES,
  addOrderNote,
  cancelOrder,
  clearManualReview,
  refundOrder,
  updateFulfilmentStatus,
  updateTracking,
} from "@/server/services/orders";
import { requirePermission } from "@/server/auth/session";

import { adminAction } from "./safe-action";

const optionalText = z.string().trim().max(500).optional().nullable();

export const updateOrderStatusAction = adminAction(
  "orders.update",
  z.object({
    orderId: z.string(),
    to: z.enum(FULFILMENT_STATUSES),
    note: optionalText,
    carrier: z.string().trim().max(60).optional(),
    trackingNumber: z.string().trim().max(80).optional(),
  }),
  async (input, staff) => {
    const move = await updateFulfilmentStatus(db, { ...input, actorId: staff.userId });
    // After commit: one email per status, deduplicated by `{orderId}:{status}`.
    await notifyOrderStatus(input.orderId, move.to);
    return move;
  },
);

export const updateTrackingAction = adminAction(
  "orders.update",
  z.object({
    orderId: z.string(),
    carrier: z.string().trim().min(1).max(60),
    trackingNumber: z.string().trim().min(1).max(80),
  }),
  async (input, staff) => updateTracking(db, { ...input, actorId: staff.userId }),
);

export const cancelOrderAction = adminAction(
  "orders.update",
  z.object({ orderId: z.string(), restock: z.boolean(), reason: optionalText }),
  async (input, staff) => {
    const order = await db.order.findUnique({
      where: { id: input.orderId },
      select: { status: true },
    });
    // Cancelling a paid order refunds it, which needs the refund permission too.
    if (order && order.status !== "PENDING_PAYMENT") await requirePermission("orders.refund");
    const res = await cancelOrder(db, getProviderByName, {
      ...input,
      reason: input.reason ?? null,
      actorId: staff.userId,
    });
    if (input.restock) expireTags(TAGS.products);
    await notifyOrderStatus(input.orderId, "CANCELLED");
    return res;
  },
);

export const refundOrderAction = adminAction(
  "orders.refund",
  z.object({
    orderId: z.string(),
    amount: z.number().int().positive(),
    restock: z.boolean(),
    reason: optionalText,
  }),
  async (input, staff) => {
    const res = await refundOrder(db, getProviderByName, {
      ...input,
      reason: input.reason ?? null,
      actorId: staff.userId,
    });
    if (res.restocked) expireTags(TAGS.products);
    await notifyRefund(input.orderId, res.refundId, input.amount, res.full);
    return res;
  },
);

export const addOrderNoteAction = adminAction(
  "orders.update",
  z.object({ orderId: z.string(), body: z.string().trim().min(1, "Write a note").max(2000) }),
  async (input, staff) => {
    await addOrderNote(db, { ...input, actorId: staff.userId });
  },
);

export const resendOrderEmailAction = adminAction(
  "orders.update",
  z.object({ orderId: z.string() }),
  async (input) => {
    const order = await db.order.findUnique({
      where: { id: input.orderId },
      select: { status: true },
    });
    if (!order || order.status === "PENDING_PAYMENT" || order.status === "REFUNDED")
      throw new UserError("There is no status email to resend for this order.");
    await notifyOrderStatus(input.orderId, order.status, { resendSuffix: String(Date.now()) });
  },
);

export const clearManualReviewAction = adminAction(
  "orders.update",
  z.object({ orderId: z.string() }),
  async (input, staff) => {
    await clearManualReview(db, { ...input, actorId: staff.userId });
  },
);
