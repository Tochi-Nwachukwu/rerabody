/**
 * Payment provider boundary. Stripe today; Paystack could replace it by
 * implementing this interface (BUILD_PLAN section 12).
 */

export type CheckoutLine = {
  name: string;
  unitAmount: number;
  quantity: number;
  imageUrl?: string | null;
  /** Stripe product tax code. Used only when automatic tax is on. */
  taxCode?: string;
};

/** Where the order ships; sales tax is worked out from this address. */
export type CheckoutAddress = {
  name: string;
  phone?: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  /** ISO 3166-1 alpha-2, e.g. "US". */
  countryCode: string;
};

export type CreateCheckoutInput = {
  orderId: string;
  orderNumber: string;
  email: string;
  currency: string;
  lines: CheckoutLine[];
  shipping: { name: string; amount: number };
  /** Null when the country could not be resolved; the provider then charges no tax. */
  address: CheckoutAddress | null;
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
      /** Sales tax included in amountTotal. Absent or 0 when no tax was charged. */
      amountTax?: number | null;
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
