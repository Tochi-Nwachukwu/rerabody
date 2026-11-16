import { beforeEach, describe, expect, it } from "vitest";

import type { PaymentProvider } from "@/server/payments/types";
import { handleEmailEvent } from "@/server/services/email-events";
import { cancelOrder, refundOrder, updateFulfilmentStatus } from "@/server/services/orders";

import { resetDb, testDb } from "../helpers/db";
import { createProduct, createRole, createUser, uid } from "../helpers/factories";

function spyProvider() {
  const refunds: { paymentId: string; amount: number; idempotencyKey: string }[] = [];
  const provider: PaymentProvider = {
    name: "fake",
    async createCheckout() {
      throw new Error("not used");
    },
    async parseWebhook() {
      throw new Error("not used");
    },
    async refund(input) {
      refunds.push(input);
      return { refundId: `re_${refunds.length}`, status: "succeeded" };
    },
  };
  return { refunds, get: () => provider };
}

/** A PAID order for 2 units, with its SALE movement already taken. */
async function paidOrder(stock = 5) {
  const p = await createProduct({ variants: [{ stock, price: 2000 }] });
  const v = p.variants[0];
  await testDb.productVariant.update({ where: { id: v.id }, data: { stock: stock - 2 } });
  const order = await testDb.order.create({
    data: {
      number: uid("RB-"),
      email: "buyer@example.test",
      status: "PAID",
      subtotal: 4000,
      shippingTotal: 395,
      total: 4395,
      currency: "GBP",
      shippingAddress: { fullName: "A" },
      shippingMethod: { name: "Standard" },
      items: {
        create: {
          variantId: v.id,
          productId: p.id,
          productName: p.name,
          variantLabel: "Default",
          sku: v.sku,
          unitPrice: 2000,
          quantity: 2,
          lineTotal: 4000,
        },
      },
      payments: {
        create: {
          provider: "fake",
          providerSessionId: uid("fs_"),
          providerPaymentId: uid("pi_"),
          amount: 4395,
          status: "SUCCEEDED",
        },
      },
      statusEvents: {
        create: [
          { toStatus: "PENDING_PAYMENT" },
          { fromStatus: "PENDING_PAYMENT", toStatus: "PAID" },
        ],
      },
    },
  });
  await testDb.inventoryMovement.create({
    data: { variantId: v.id, delta: -2, reason: "SALE", orderId: order.id },
  });
  return { order, variantId: v.id };
}

describe("order lifecycle", () => {
  let actorId: string;
  beforeEach(async () => {
    await resetDb();
    actorId = (await createUser({ roleId: (await createRole("Owner")).id })).id;
  });

  it("walks PAID to DELIVERED, writing one event per move with the actor", async () => {
    const { order } = await paidOrder();
    await updateFulfilmentStatus(testDb, { orderId: order.id, to: "PROCESSING", actorId });
    await expect(
      updateFulfilmentStatus(testDb, { orderId: order.id, to: "SHIPPED", actorId }),
    ).rejects.toThrow(/carrier and tracking/);
    await updateFulfilmentStatus(testDb, {
      orderId: order.id,
      to: "SHIPPED",
      actorId,
      carrier: "Royal Mail",
      trackingNumber: "AB1",
    });
    await updateFulfilmentStatus(testDb, { orderId: order.id, to: "OUT_FOR_DELIVERY", actorId });
    await updateFulfilmentStatus(testDb, { orderId: order.id, to: "DELIVERED", actorId });

    const events = await testDb.orderStatusEvent.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: "asc" },
    });
    expect(
      events.filter((e) =>
        ["PAID", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(e.toStatus),
      ),
    ).toHaveLength(5);
    expect(events.slice(2).every((e) => e.actorId === actorId)).toBe(true);
    const after = await testDb.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after).toMatchObject({
      status: "DELIVERED",
      trackingCarrier: "Royal Mail",
      trackingNumber: "AB1",
    });
    await expect(
      updateFulfilmentStatus(testDb, { orderId: order.id, to: "PROCESSING", actorId }),
    ).rejects.toThrow(/cannot move/);
  });

  it("a double-clicked status button applies once", async () => {
    const { order } = await paidOrder();
    const results = await Promise.allSettled([
      updateFulfilmentStatus(testDb, { orderId: order.id, to: "PROCESSING", actorId }),
      updateFulfilmentStatus(testDb, { orderId: order.id, to: "PROCESSING", actorId }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      await testDb.orderStatusEvent.count({ where: { orderId: order.id, toStatus: "PROCESSING" } }),
    ).toBe(1);
  });

  it("a full refund calls the provider, restocks when ticked and moves the order to REFUNDED", async () => {
    const { order, variantId } = await paidOrder(5);
    const spy = spyProvider();
    const res = await refundOrder(testDb, spy.get, {
      orderId: order.id,
      amount: 4395,
      restock: true,
      reason: "Damaged in post",
      actorId,
    });
    expect(res).toMatchObject({ full: true, restocked: true, refundId: "re_1" });
    expect(spy.refunds).toEqual([expect.objectContaining({ amount: 4395 })]);
    expect(
      (await testDb.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock,
    ).toBe(5);
    expect((await testDb.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
      "REFUNDED",
    );
    expect((await testDb.payment.findFirstOrThrow({ where: { orderId: order.id } })).status).toBe(
      "REFUNDED",
    );
    expect(
      await testDb.inventoryMovement.count({
        where: { orderId: order.id, reason: "REFUND", delta: 2 },
      }),
    ).toBe(1);
  });

  it("a partial refund without restock keeps the status and stock", async () => {
    const { order, variantId } = await paidOrder(5);
    const spy = spyProvider();
    await refundOrder(testDb, spy.get, {
      orderId: order.id,
      amount: 1000,
      restock: false,
      reason: null,
      actorId,
    });
    expect((await testDb.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PAID");
    expect(
      (await testDb.payment.findFirstOrThrow({ where: { orderId: order.id } })).refundedAmount,
    ).toBe(1000);
    expect(
      (await testDb.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock,
    ).toBe(3);
    await expect(
      refundOrder(testDb, spy.get, {
        orderId: order.id,
        amount: 4000,
        restock: false,
        reason: null,
        actorId,
      }),
    ).rejects.toThrow(/up to 3395/);
  });

  it("cancelling a paid order refunds it in full and can restock", async () => {
    const { order, variantId } = await paidOrder(5);
    const spy = spyProvider();
    await cancelOrder(testDb, spy.get, {
      orderId: order.id,
      restock: true,
      reason: "Customer asked",
      actorId,
    });
    expect(spy.refunds[0]).toMatchObject({ amount: 4395 });
    expect((await testDb.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
      "CANCELLED",
    );
    expect(
      (await testDb.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock,
    ).toBe(5);
  });

  it("refuses to cancel a shipped order", async () => {
    const { order } = await paidOrder();
    await updateFulfilmentStatus(testDb, { orderId: order.id, to: "PROCESSING", actorId });
    await updateFulfilmentStatus(testDb, {
      orderId: order.id,
      to: "SHIPPED",
      actorId,
      carrier: "X",
      trackingNumber: "1",
    });
    await expect(
      cancelOrder(testDb, spyProvider().get, {
        orderId: order.id,
        restock: true,
        reason: null,
        actorId,
      }),
    ).rejects.toThrow(/not shipped/);
  });
});

describe("email provider events", () => {
  beforeEach(resetDb);

  it("marks bounced addresses and is idempotent", async () => {
    await testDb.newsletterSubscriber.create({
      data: { email: "bounce@example.test", tokenHash: "h1" },
    });
    await testDb.emailLog.create({
      data: { to: "bounce@example.test", template: "welcome", providerId: "em_1", status: "SENT" },
    });
    const event = {
      id: "msg_1",
      type: "email.bounced",
      emailId: "em_1",
      to: ["Bounce@example.test"],
    };
    expect((await handleEmailEvent(testDb, event)).status).toBe("processed");
    expect((await handleEmailEvent(testDb, event)).status).toBe("duplicate");
    expect(
      (
        await testDb.newsletterSubscriber.findUniqueOrThrow({
          where: { email: "bounce@example.test" },
        })
      ).status,
    ).toBe("BOUNCED");
    expect((await testDb.emailLog.findFirstOrThrow({ where: { providerId: "em_1" } })).status).toBe(
      "BOUNCED",
    );
  });
});
