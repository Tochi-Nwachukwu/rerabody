/**
 * Payment provider boundary. Stripe today; Paystack could replace it by
 * implementing this interface (BUILD_PLAN section 12).
 */

export type CheckoutLine = {
  name: string;
  unitAmount: number;
  quantity: number;
  imageUrl?: string | null;
};

export type CreateCheckoutInput = {
  orderId: string;
  orderNumber: string;
  email: string;
  currency: string;
  lines: CheckoutLine[];
  shipping: { name: string; amount: number };
  discount: { amount: number; label: string } | null;
  successUrl: string;
  cancelUrl: string;
};

export type PaymentEvent =
  | {
      kind: "checkout.completed";
      eventId: string;
      sessionId: string;
      paymentId: string | null;
      amountTotal: number | null;
    }
  | { kind: "checkout.expired"; eventId: string; sessionId: string }
  | { kind: "checkout.failed"; eventId: string; sessionId: string }
  | { kind: "ignored"; eventId: string; type: string };

export class WebhookSignatureError extends Error {
  constructor(message = "Invalid webhook signature") {
    super(message);
    this.name = "WebhookSignatureError";
  }
}

export interface PaymentProvider {
  readonly name: "stripe" | "fake";
  createCheckout(input: CreateCheckoutInput): Promise<{ sessionId: string; url: string }>;
  /** Verifies the signature and maps the provider event. Throws WebhookSignatureError when invalid. */
  parseWebhook(rawBody: string, headers: Headers): Promise<PaymentEvent>;
  refund(input: {
    paymentId: string;
    amount: number;
    idempotencyKey: string;
  }): Promise<{ refundId: string; status: string }>;
}
