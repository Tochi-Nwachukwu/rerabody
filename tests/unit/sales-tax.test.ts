import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { countryCode } from "@/lib/country";
import { addressSchema } from "@/lib/schemas/checkout";
import { SHIPPING_TAX_CODE } from "@/lib/tax-codes";
import type { CreateCheckoutInput, PaymentProvider } from "@/server/payments/types";
import { addToCart } from "@/server/services/cart";
import { createOrderFromCart } from "@/server/services/checkout";
import { handlePaymentEvent } from "@/server/services/payment-webhook";
import { salesReport } from "@/server/services/reports";

import { resetDb, testDb } from "../helpers/db";
import { createProduct } from "../helpers/factories";

// Captures what the Stripe provider sends, without calling Stripe.
const calls = vi.hoisted(() => ({ customers: [] as unknown[], sessions: [] as unknown[] }));
vi.mock("stripe", () => {
  class FakeStripe {
    customers = {
      create: async (params: unknown) => {
        calls.customers.push(params);
        return { id: "cus_test" };
      },
    };
    checkout = {
      sessions: {
        create: async (params: unknown) => {
          calls.sessions.push(params);
          return { id: "cs_test", url: "https://checkout.stripe.test/cs_test" };
        },
      },
    };
    coupons = { create: async () => ({ id: "co_test" }) };
  }
  return { default: FakeStripe };
});

const { createStripeProvider, mapStripeEvent } = await import("@/server/payments/stripe");

const usAddress = {
  fullName: "Ada Lovelace",
  phone: "5125550100",
  line1: "1 Congress Ave",
  line2: undefined,
  city: "Austin",
  state: "TX",
  postalCode: "78701",
  country: "United States",
};

const checkoutInput = (overrides: Partial<CreateCheckoutInput> = {}): CreateCheckoutInput => ({
  orderId: "ord_1",
  orderNumber: "RB-1",
  email: "ada@example.test",
  currency: "USD",
  lines: [{ name: "Body butter", unitAmount: 2400, quantity: 1, taxCode: "txcd_32050013" }],
  shipping: { name: "Standard", amount: 500 },
  address: {
    name: "Ada Lovelace",
    line1: "1 Congress Ave",
    city: "Austin",
    state: "TX",
    postalCode: "78701",
    countryCode: "US",
  },
  discount: null,
  successUrl: "https://shop.test/ok",
  cancelUrl: "https://shop.test/cancel",
  ...overrides,
});

describe("country codes", () => {
  it("resolves names, aliases and codes", () => {
    expect(countryCode("United States")).toBe("US");
    expect(countryCode(" usa ")).toBe("US");
    expect(countryCode("us")).toBe("US");
    expect(countryCode("United Kingdom")).toBe("GB");
    expect(countryCode("UK")).toBe("GB");
    expect(countryCode("Nigeria")).toBe("NG");
    expect(countryCode("Narnia")).toBeNull();
    expect(countryCode("ZZ")).toBeNull();
  });
});

describe("address validation", () => {
  it("requires a state and ZIP code for US addresses", () => {
    const r = addressSchema.safeParse({ ...usAddress, state: "", postalCode: "" });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path.join("."))).toEqual(["state", "postalCode"]);
    expect(addressSchema.safeParse({ ...usAddress, postalCode: "7870" }).success).toBe(false);
    expect(addressSchema.safeParse({ ...usAddress, postalCode: "78701-1234" }).success).toBe(true);
  });

  it("accepts other countries without a state and rejects unknown countries", () => {
    const uk = { ...usAddress, state: "", postalCode: "E1 1AA", country: "United Kingdom" };
    expect(addressSchema.safeParse(uk).success).toBe(true);
    const r = addressSchema.safeParse({ ...usAddress, country: "Narnia" });
    expect(r.error?.issues[0]?.path).toEqual(["country"]);
  });
});

describe("Stripe provider with automatic tax", () => {
  beforeEach(() => {
    calls.customers.length = 0;
    calls.sessions.length = 0;
  });

  it("taxes the shipping address with per-line tax codes when tax is on", async () => {
    const provider = createStripeProvider({
      secretKey: "sk_test_x",
      webhookSecret: "whsec_x",
      automaticTax: true,
    });
    await provider.createCheckout(checkoutInput());
    expect(calls.customers[0]).toMatchObject({
      email: "ada@example.test",
      shipping: {
        name: "Ada Lovelace",
        address: { line1: "1 Congress Ave", state: "TX", postal_code: "78701", country: "US" },
      },
    });
    const session = calls.sessions[0] as Stripe.Checkout.SessionCreateParams;
    expect(session.customer).toBe("cus_test");
    expect(session.customer_email).toBeUndefined();
    expect(session.automatic_tax).toEqual({ enabled: true });
    expect(session.line_items?.[0]?.price_data).toMatchObject({
      tax_behavior: "exclusive",
      product_data: { tax_code: "txcd_32050013" },
    });
    expect(session.shipping_options?.[0]?.shipping_rate_data).toMatchObject({
      tax_behavior: "exclusive",
      tax_code: SHIPPING_TAX_CODE,
    });
    expect(session).not.toHaveProperty("payment_method_types");
  });

  it("sends no tax settings when tax is off or the address is unknown", async () => {
    const off = createStripeProvider({ secretKey: "sk_test_x", webhookSecret: "whsec_x" });
    await off.createCheckout(checkoutInput());
    const on = createStripeProvider({
      secretKey: "sk_test_x",
      webhookSecret: "whsec_x",
      automaticTax: true,
    });
    await on.createCheckout(checkoutInput({ address: null }));
    expect(calls.customers).toHaveLength(0);
    for (const s of calls.sessions as Stripe.Checkout.SessionCreateParams[]) {
      expect(s.automatic_tax).toBeUndefined();
      expect(s.customer_email).toBe("ada@example.test");
      expect(s.line_items?.[0]?.price_data?.product_data?.tax_code).toBeUndefined();
    }
  });

  it("reads the tax charged from the completed session", () => {
    const event = {
      id: "evt_1",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test",
          payment_status: "paid",
          payment_intent: "pi_1",
          amount_total: 3123,
          total_details: { amount_tax: 223, amount_discount: 0, amount_shipping: 500 },
        },
      },
    } as unknown as Stripe.Event;
    expect(mapStripeEvent(event)).toMatchObject({
      kind: "checkout.completed",
      amountTotal: 3123,
      amountTax: 223,
    });
  });
});

describe("tax through checkout, payment and reports", () => {
  beforeEach(resetDb);

  function recordingProvider() {
    const inputs: CreateCheckoutInput[] = [];
    const provider: PaymentProvider = {
      name: "fake",
      async createCheckout(input) {
        inputs.push(input);
        return { sessionId: `fs_${inputs.length}`, url: "https://pay.test" };
      },
      async parseWebhook() {
        throw new Error("unused");
      },
      async refund() {
        return { refundId: "re_1", status: "succeeded" };
      },
    };
    return { provider, inputs };
  }

  async function orderWithTax() {
    const category = await testDb.category.create({
      data: { name: "Body butters", slug: "body-butters", taxCode: "txcd_32050013" },
    });
    const p = await createProduct({ categoryId: category.id, variants: [{ price: 2400 }] });
    await addToCart(
      testDb,
      { userId: null, guestToken: "g" },
      { variantId: p.variants[0].id, quantity: 1 },
    );
    const ship = await testDb.shippingMethod.create({ data: { name: "Standard", price: 500 } });
    const { provider, inputs } = recordingProvider();
    const res = await createOrderFromCart(testDb, provider, {
      identity: { userId: null, guestToken: "g" },
      userId: null,
      email: "ada@example.test",
      address: usAddress,
      shippingMethodId: ship.id,
      saveAddress: false,
      currency: "USD",
      appUrl: "http://localhost:3000",
      now: new Date(),
      format: String,
    });
    return { res, inputs };
  }

  it("passes the category tax code and the resolved country to the provider", async () => {
    const { inputs } = await orderWithTax();
    expect(inputs[0]?.lines[0]?.taxCode).toBe("txcd_32050013");
    expect(inputs[0]?.address).toMatchObject({
      countryCode: "US",
      state: "TX",
      postalCode: "78701",
    });
  });

  it("adds the tax charged to the order and lets refunds cover it", async () => {
    const { res } = await orderWithTax();
    const outcome = await handlePaymentEvent(testDb, "fake", {
      kind: "checkout.completed",
      eventId: "evt_tax",
      sessionId: "fs_1",
      paymentId: "pi_1",
      amountTotal: 2900 + 223,
      amountTax: 223,
    });
    expect(outcome).toMatchObject({ status: "paid", needsReview: false });
    const order = await testDb.order.findUniqueOrThrow({
      where: { id: res.orderId },
      include: { payments: true },
    });
    expect(order).toMatchObject({ status: "PAID", taxTotal: 223, total: 3123 });
    expect(order.payments[0]?.amount).toBe(3123);
  });

  it("still flags a charge that does not match subtotal, shipping and tax", async () => {
    await orderWithTax();
    const outcome = await handlePaymentEvent(testDb, "fake", {
      kind: "checkout.completed",
      eventId: "evt_bad",
      sessionId: "fs_1",
      paymentId: "pi_1",
      amountTotal: 5000,
      amountTax: 223,
    });
    expect(outcome).toMatchObject({ status: "paid", needsReview: true });
  });

  it("reports revenue without sales tax, returning tax in proportion on refunds", async () => {
    const { res } = await orderWithTax();
    await handlePaymentEvent(testDb, "fake", {
      kind: "checkout.completed",
      eventId: "evt_r",
      sessionId: "fs_1",
      paymentId: "pi_1",
      amountTotal: 3000,
      amountTax: 100,
    });
    // Order: 2900 before tax + 100 tax = 3000. A third is refunded.
    await testDb.payment.updateMany({
      where: { orderId: res.orderId },
      data: { refundedAmount: 1000 },
    });
    const from = new Date(Date.now() - 86400_000);
    const to = new Date(Date.now() + 86400_000);
    const r = await salesReport(testDb, { from, to });
    expect(r.taxCollected).toBe(67); // 100 × 2000/3000, rounded
    expect(r.revenue).toBe(3000 - 1000 - 67);
    expect(r.averageOrderValue).toBe(2900);
  });
});
