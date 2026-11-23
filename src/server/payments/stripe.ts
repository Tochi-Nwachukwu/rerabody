import Stripe from "stripe";

import { DEFAULT_PRODUCT_TAX_CODE, SHIPPING_TAX_CODE } from "@/lib/tax-codes";

import {
  type CheckoutAddress,
  type PaymentEvent,
  type PaymentProvider,
  WebhookSignatureError,
} from "./types";

export function createStripeProvider(config: {
  secretKey: string;
  webhookSecret: string;
  /** Stripe Tax. Only collects tax where the account has an active registration. */
  automaticTax?: boolean;
}): PaymentProvider {
  const stripe = new Stripe(config.secretKey, {
    maxNetworkRetries: 2,
    appInfo: { name: "rera-body-store" },
  });

  return {
    name: "stripe",

    async createCheckout(input) {
      // A one-off coupon carries the discount so Stripe's total equals the order total exactly.
      const discounts = input.discount
        ? [
            {
              coupon: (
                await stripe.coupons.create(
                  {
                    amount_off: input.discount.amount,
                    currency: input.currency.toLowerCase(),
                    duration: "once",
                    max_redemptions: 1,
                    name: input.discount.label.slice(0, 40),
                  },
                  { idempotencyKey: `coupon-${input.orderId}` },
                )
              ).id,
            },
          ]
        : undefined;

      // Stripe Tax works out the tax from the customer's shipping address, which the
      // store has already collected. Without a resolvable address no tax is charged.
      const tax = config.automaticTax === true && input.address !== null;
      const customer = tax
        ? (
            await stripe.customers.create(
              {
                email: input.email,
                name: input.address!.name,
                phone: input.address!.phone,
                address: stripeAddress(input.address!),
                shipping: {
                  name: input.address!.name,
                  phone: input.address!.phone,
                  address: stripeAddress(input.address!),
                },
                metadata: { orderId: input.orderId, orderNumber: input.orderNumber },
              },
              { idempotencyKey: `customer-${input.orderId}` },
            )
          ).id
        : undefined;

      const session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          ...(customer ? { customer } : { customer_email: input.email }),
          ...(tax ? { automatic_tax: { enabled: true } } : {}),
          client_reference_id: input.orderId,
          metadata: { orderId: input.orderId, orderNumber: input.orderNumber },
          payment_intent_data: {
            metadata: { orderId: input.orderId, orderNumber: input.orderNumber },
          },
          line_items: input.lines.map((l) => ({
            quantity: l.quantity,
            price_data: {
              currency: input.currency.toLowerCase(),
              unit_amount: l.unitAmount,
              // US prices are shown before tax; Stripe adds tax on top.
              ...(tax ? { tax_behavior: "exclusive" as const } : {}),
              product_data: {
                name: l.name,
                images: l.imageUrl?.startsWith("https://") ? [l.imageUrl] : undefined,
                ...(tax ? { tax_code: l.taxCode ?? DEFAULT_PRODUCT_TAX_CODE } : {}),
              },
            },
          })),
          shipping_options: [
            {
              shipping_rate_data: {
                type: "fixed_amount",
                display_name: input.shipping.name.slice(0, 100),
                fixed_amount: {
                  amount: input.shipping.amount,
                  currency: input.currency.toLowerCase(),
                },
                ...(tax ? { tax_behavior: "exclusive" as const, tax_code: SHIPPING_TAX_CODE } : {}),
              },
            },
          ],
          discounts,
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
        },
        { idempotencyKey: `checkout-${input.orderId}` },
      );
      if (!session.url) throw new Error("Stripe did not return a checkout URL");
      return { sessionId: session.id, url: session.url };
    },

    async parseWebhook(rawBody, headers) {
      const signature = headers.get("stripe-signature");
      if (!signature) throw new WebhookSignatureError("Missing Stripe-Signature header");
      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(rawBody, signature, config.webhookSecret);
      } catch (error) {
        throw new WebhookSignatureError(
          error instanceof Error ? error.message : "Invalid signature",
        );
      }
      return mapStripeEvent(event);
    },

    async refund({ paymentId, amount, idempotencyKey }) {
      const refund = await stripe.refunds.create(
        { payment_intent: paymentId, amount },
        { idempotencyKey },
      );
      return { refundId: refund.id, status: refund.status ?? "pending" };
    },
  };
}

export function mapStripeEvent(event: Stripe.Event): PaymentEvent {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const s = event.data.object;
      // Delayed payment methods complete the session unpaid; wait for async_payment_succeeded.
      if (s.payment_status !== "paid" && s.payment_status !== "no_payment_required")
        return { kind: "ignored", eventId: event.id, type: event.type };
      return {
        kind: "checkout.completed",
        eventId: event.id,
        sessionId: s.id,
        paymentId:
          typeof s.payment_intent === "string" ? s.payment_intent : (s.payment_intent?.id ?? null),
        amountTotal: s.amount_total,
        amountTax: s.total_details?.amount_tax ?? 0,
      };
    }
    case "checkout.session.expired":
      return { kind: "checkout.expired", eventId: event.id, sessionId: event.data.object.id };
    case "checkout.session.async_payment_failed":
      return { kind: "checkout.failed", eventId: event.id, sessionId: event.data.object.id };
    default:
      return { kind: "ignored", eventId: event.id, type: event.type };
  }
}

function stripeAddress(a: CheckoutAddress) {
  return {
    line1: a.line1,
    line2: a.line2,
    city: a.city,
    state: a.state,
    postal_code: a.postalCode,
    country: a.countryCode,
  };
}
