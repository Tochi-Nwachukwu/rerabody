import { beforeEach, describe, expect, it } from "vitest";

import { createFakeProvider } from "@/server/payments/fake";
import { addToCart, applyCoupon, loadCart, mergeGuestCart } from "@/server/services/cart";
import { createOrderFromCart } from "@/server/services/checkout";
import { handlePaymentEvent } from "@/server/services/payment-webhook";

import { resetDb, testDb } from "../helpers/db";
import { createProduct, createUser } from "../helpers/factories";

const fmt = (n: number) => `£${(n / 100).toFixed(2)}`;
const now = new Date();
const provider = createFakeProvider({
  secret: "test-secret-test-secret-test-secret",
  appUrl: "http://localhost:3000",
});
const address = {
  fullName: "Ada Lovelace",
  phone: "07000000000",
  line1: "1 Test Street",
  line2: undefined,
  city: "London",
  state: undefined,
  postalCode: undefined,
  country: "United Kingdom",
};

async function shipping(price = 395) {
  return testDb.shippingMethod.create({ data: { name: "Standard", price } });
}

async function checkout(
  guestToken: string,
  opts: { userId?: string | null; email?: string; isGift?: boolean; giftMessage?: string } = {},
) {
  const ship = await shipping();
  return createOrderFromCart(testDb, provider, {
    identity: { userId: opts.userId ?? null, guestToken: opts.userId ? null : guestToken },
    userId: opts.userId ?? null,
    email: opts.email ?? "ada@example.test",
    address,
    shippingMethodId: ship.id,
    saveAddress: false,
    isGift: opts.isGift,
    giftMessage: opts.giftMessage,
    currency: "GBP",
    appUrl: "http://localhost:3000",
    now,
    format: fmt,
  });
}

async function pay(orderId: string, eventId = `evt_${orderId}`) {
  const payment = await testDb.payment.findFirstOrThrow({ where: { orderId } });
  const order = await testDb.order.findUniqueOrThrow({ where: { id: orderId } });
  return handlePaymentEvent(testDb, "fake", {
    kind: "checkout.completed",
    eventId,
    sessionId: payment.providerSessionId!,
    paymentId: `pi_${orderId}`,
    amountTotal: order.total,
  });
}

describe("cart", () => {
  beforeEach(resetDb);

  it("caps quantity at stock and revalidates on load", async () => {
    const p = await createProduct({ variants: [{ stock: 3, price: 1000 }] });
    const guest = { userId: null, guestToken: "g1" };
    const res = await addToCart(testDb, guest, { variantId: p.variants[0].id, quantity: 5 });
    expect(res).toEqual({ capped: true, quantity: 3 });

    await testDb.productVariant.update({
      where: { id: p.variants[0].id },
      data: { stock: 2, price: 1200 },
    });
    const view = await loadCart(testDb, guest, { now, format: fmt });
    expect(view.lines[0]).toMatchObject({ quantity: 2, unitPrice: 1200, lineTotal: 2400 });
    expect(view.notices.join(" ")).toMatch(/Only 2/);
    expect(view.notices.join(" ")).toMatch(/changed from £10.00 to £12.00/);
    // The price notice shows once.
    expect((await loadCart(testDb, guest, { now, format: fmt })).notices).toEqual([]);

    await testDb.product.update({ where: { id: p.id }, data: { status: "ARCHIVED" } });
    const after = await loadCart(testDb, guest, { now, format: fmt });
    expect(after.lines).toHaveLength(0);
    expect(after.notices[0]).toMatch(/no longer available/);
  });

  it("merges a guest cart into the account cart on sign in", async () => {
    const a = await createProduct({ variants: [{ stock: 4 }] });
    const b = await createProduct({ variants: [{ stock: 10 }] });
    const user = await createUser();
    await addToCart(
      testDb,
      { userId: user.id, guestToken: null },
      { variantId: a.variants[0].id, quantity: 3 },
    );
    await addToCart(
      testDb,
      { userId: null, guestToken: "guest" },
      { variantId: a.variants[0].id, quantity: 3 },
    );
    await addToCart(
      testDb,
      { userId: null, guestToken: "guest" },
      { variantId: b.variants[0].id, quantity: 2 },
    );
    const coupon = await testDb.coupon.create({
      data: { code: "WELCOME", type: "PERCENT", value: 10 },
    });
    await testDb.cart.update({ where: { guestToken: "guest" }, data: { couponId: coupon.id } });

    await mergeGuestCart(testDb, "guest", user.id);

    const cart = await testDb.cart.findUniqueOrThrow({
      where: { userId: user.id },
      include: { items: true },
    });
    expect(cart.items.find((i) => i.variantId === a.variants[0].id)?.quantity).toBe(4); // 3 + 3 capped at stock 4
    expect(cart.items.find((i) => i.variantId === b.variants[0].id)?.quantity).toBe(2);
    expect(cart.couponId).toBe(coupon.id);
    expect(await testDb.cart.findUnique({ where: { guestToken: "guest" } })).toBeNull();
  });
});

describe("checkout and payment webhook", () => {
  beforeEach(resetDb);

  it("recomputes totals from the database and creates a pending order with a payment session", async () => {
    const p = await createProduct({ variants: [{ stock: 5, price: 1800 }] });
    await addToCart(
      testDb,
      { userId: null, guestToken: "g" },
      { variantId: p.variants[0].id, quantity: 2 },
    );
    // A tampered cart price is ignored: totals come from the variant.
    await testDb.cartItem.updateMany({ data: { lastSeenPrice: 1 } });
    const res = await checkout("g");
    const order = await testDb.order.findUniqueOrThrow({
      where: { id: res.orderId },
      include: { items: true, statusEvents: true, payments: true },
    });
    expect(order).toMatchObject({
      status: "PENDING_PAYMENT",
      subtotal: 3600,
      shippingTotal: 395,
      total: 3995,
      currency: "GBP",
    });
    expect(order.number).toMatch(/^RB-\d+$/);
    expect(order.items[0]).toMatchObject({
      unitPrice: 1800,
      quantity: 2,
      lineTotal: 3600,
      productName: p.name,
    });
    expect(order.statusEvents.map((e) => e.toStatus)).toEqual(["PENDING_PAYMENT"]);
    expect(order.payments[0]).toMatchObject({ provider: "fake", status: "PENDING", amount: 3995 });
    expect(order.guestAccessTokenHash).not.toBe(res.guestToken);
    expect(res.url).toContain("/checkout/fake-pay?session=fs_");
  });

  it("stores the gift flag and message, and drops a message when the order is not a gift", async () => {
    const p = await createProduct({ variants: [{ stock: 5, price: 1800 }] });
    const id = { userId: null, guestToken: "gift" };
    await addToCart(testDb, id, { variantId: p.variants[0].id, quantity: 1 });
    const gift = await checkout("gift", { isGift: true, giftMessage: "Happy birthday, Mum" });
    expect(await testDb.order.findUniqueOrThrow({ where: { id: gift.orderId } })).toMatchObject({
      isGift: true,
      giftMessage: "Happy birthday, Mum",
    });

    await addToCart(
      testDb,
      { userId: null, guestToken: "plain" },
      { variantId: p.variants[0].id, quantity: 1 },
    );
    const plain = await checkout("plain", { isGift: false, giftMessage: "ignored" });
    expect(await testDb.order.findUniqueOrThrow({ where: { id: plain.orderId } })).toMatchObject({
      isGift: false,
      giftMessage: null,
    });
  });

  it("adds one gift box per gift set at the fee in settings, and pays without review", async () => {
    const giftSets = await testDb.category.create({
      data: { name: "Gift Sets", slug: "gift-sets" },
    });
    await testDb.siteSetting.create({ data: { key: "giftSets", value: { boxFee: 650 } } });
    const set = await createProduct({
      categoryId: giftSets.id,
      variants: [{ stock: 5, price: 8700 }],
    });
    const butter = await createProduct({ variants: [{ stock: 5, price: 1800 }] });
    const id = { userId: null, guestToken: "box" };
    await addToCart(testDb, id, { variantId: set.variants[0].id, quantity: 2 });
    await addToCart(testDb, id, { variantId: butter.variants[0].id, quantity: 1 });

    const cart = await loadCart(testDb, id, { now, format: fmt });
    expect(cart.giftBox).toMatchObject({ quantity: 2, unitPrice: 650, total: 1300 });
    expect(cart.subtotal).toBe(8700 * 2 + 1800 + 1300);

    const res = await checkout("box");
    const order = await testDb.order.findUniqueOrThrow({
      where: { id: res.orderId },
      include: { items: true },
    });
    expect(order.subtotal).toBe(8700 * 2 + 1800 + 1300);
    expect(order.items.find((i) => i.sku === "GIFT-BOX")).toMatchObject({
      productName: "Gift box",
      variantId: null,
      unitPrice: 650,
      quantity: 2,
      lineTotal: 1300,
    });
    expect(await pay(res.orderId)).toMatchObject({ status: "paid", needsReview: false });
  });

  it("re-validates the coupon when the order is created (rule 8)", async () => {
    const p = await createProduct({ variants: [{ stock: 5, price: 5000 }] });
    const id = { userId: null, guestToken: "g" };
    await addToCart(testDb, id, { variantId: p.variants[0].id, quantity: 1 });
    const coupon = await testDb.coupon.create({
      data: { code: "TEN", type: "PERCENT", value: 10 },
    });
    await applyCoupon(testDb, id, { code: "ten", now, format: fmt });
    await testDb.coupon.update({ where: { id: coupon.id }, data: { isActive: false } });
    await expect(checkout("g")).rejects.toThrow(/Code TEN no longer applies/);
    expect(await testDb.order.count()).toBe(0);
  });

  it("marks the order paid, takes stock, records the coupon and clears the cart in one go", async () => {
    const p = await createProduct({ variants: [{ stock: 5, price: 2000 }] });
    const id = { userId: null, guestToken: "g" };
    await addToCart(testDb, id, { variantId: p.variants[0].id, quantity: 2 });
    await testDb.coupon.create({ data: { code: "FIVER", type: "FIXED", value: 500 } });
    await applyCoupon(testDb, id, { code: "FIVER", now, format: fmt });
    const { orderId } = await checkout("g");

    const outcome = await pay(orderId);
    expect(outcome).toMatchObject({ status: "paid", needsReview: false });

    const order = await testDb.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { statusEvents: { orderBy: { createdAt: "asc" } }, payments: true },
    });
    expect(order.status).toBe("PAID");
    expect(order.total).toBe(2000 * 2 - 500 + 395);
    expect(order.paidAt).not.toBeNull();
    expect(order.statusEvents.map((e) => [e.fromStatus, e.toStatus, e.actorId])).toEqual([
      [null, "PENDING_PAYMENT", null],
      ["PENDING_PAYMENT", "PAID", null],
    ]);
    expect(order.payments[0]).toMatchObject({
      status: "SUCCEEDED",
      providerPaymentId: `pi_${orderId}`,
    });
    expect(
      (await testDb.productVariant.findUniqueOrThrow({ where: { id: p.variants[0].id } })).stock,
    ).toBe(3);
    expect(await testDb.inventoryMovement.findMany({ where: { orderId } })).toEqual([
      expect.objectContaining({ delta: -2, reason: "SALE" }),
    ]);
    expect(await testDb.couponRedemption.findUnique({ where: { orderId } })).toMatchObject({
      amount: 500,
      email: "ada@example.test",
    });
    const cart = await testDb.cart.findUniqueOrThrow({
      where: { guestToken: "g" },
      include: { items: true },
    });
    expect(cart.items).toHaveLength(0);
    expect(cart.couponId).toBeNull();
  });

  it("ignores a duplicate webhook delivery (rule 2)", async () => {
    const p = await createProduct({ variants: [{ stock: 5 }] });
    await addToCart(
      testDb,
      { userId: null, guestToken: "g" },
      { variantId: p.variants[0].id, quantity: 1 },
    );
    const { orderId } = await checkout("g");
    expect((await pay(orderId, "evt_same")).status).toBe("paid");
    expect(await pay(orderId, "evt_same")).toEqual({ status: "duplicate" });
    // A second, different event for the same session does not take stock twice either.
    expect((await pay(orderId, "evt_other")).status).toBe("ignored");
    expect(
      (await testDb.productVariant.findUniqueOrThrow({ where: { id: p.variants[0].id } })).stock,
    ).toBe(4);
    expect(await testDb.orderStatusEvent.count({ where: { orderId, toStatus: "PAID" } })).toBe(1);
    expect(await testDb.processedWebhookEvent.count()).toBe(2);
  });

  it("cancels the order when the session expires and leaves stock and cart alone", async () => {
    const p = await createProduct({ variants: [{ stock: 5 }] });
    await addToCart(
      testDb,
      { userId: null, guestToken: "g" },
      { variantId: p.variants[0].id, quantity: 1 },
    );
    const { orderId } = await checkout("g");
    const payment = await testDb.payment.findFirstOrThrow({ where: { orderId } });
    expect(
      await handlePaymentEvent(testDb, "fake", {
        kind: "checkout.expired",
        eventId: "evt_exp",
        sessionId: payment.providerSessionId!,
      }),
    ).toEqual({ status: "cancelled", orderId });
    expect((await testDb.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe(
      "CANCELLED",
    );
    expect((await testDb.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe(
      "EXPIRED",
    );
    expect(
      (await testDb.productVariant.findUniqueOrThrow({ where: { id: p.variants[0].id } })).stock,
    ).toBe(5);
    expect(await testDb.cartItem.count()).toBe(1);
  });

  it("two simultaneous orders for the last unit: one takes it, the other is paid and flagged (rule 3)", async () => {
    const p = await createProduct({ variants: [{ stock: 1, price: 3000 }] });
    await addToCart(
      testDb,
      { userId: null, guestToken: "a" },
      { variantId: p.variants[0].id, quantity: 1 },
    );
    await addToCart(
      testDb,
      { userId: null, guestToken: "b" },
      { variantId: p.variants[0].id, quantity: 1 },
    );
    const first = await checkout("a", { email: "a@example.test" });
    const second = await checkout("b", { email: "b@example.test" });

    const outcomes = await Promise.all([pay(first.orderId), pay(second.orderId)]);
    expect(outcomes.every((o) => o.status === "paid")).toBe(true);

    const orders = await testDb.order.findMany({
      where: { id: { in: [first.orderId, second.orderId] } },
    });
    expect(orders.every((o) => o.status === "PAID")).toBe(true);
    expect(orders.filter((o) => o.needsManualReview)).toHaveLength(1);
    expect(orders.find((o) => o.needsManualReview)?.manualReviewReason).toMatch(/Not enough stock/);
    expect(
      (await testDb.productVariant.findUniqueOrThrow({ where: { id: p.variants[0].id } })).stock,
    ).toBe(0);
    expect(await testDb.inventoryMovement.count({ where: { reason: "SALE" } })).toBe(1);
  });

  it("refuses to create an order when stock ran out before paying", async () => {
    const p = await createProduct({ variants: [{ stock: 2 }] });
    await addToCart(
      testDb,
      { userId: null, guestToken: "g" },
      { variantId: p.variants[0].id, quantity: 2 },
    );
    await testDb.productVariant.update({ where: { id: p.variants[0].id }, data: { stock: 1 } });
    await expect(checkout("g")).rejects.toThrow(/Only 1 of/);
  });
});
