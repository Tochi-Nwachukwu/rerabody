import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { type PaymentEvent, type PaymentProvider, WebhookSignatureError } from "./types";

/**
 * Test double for Stripe. Checkout goes to /checkout/fake-pay; the buttons there
 * send signed events through the same webhook pipeline as Stripe.
 */
export const FAKE_SIGNATURE_HEADER = "x-fake-signature";

export function signFakeEvent(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function createFakeProvider(config: { secret: string; appUrl: string }): PaymentProvider {
  return {
    name: "fake",
    async createCheckout(input) {
      const sessionId = `fs_${randomBytes(12).toString("hex")}`;
      const qs = new URLSearchParams({
        session: sessionId,
        success: input.successUrl.replace("{CHECKOUT_SESSION_ID}", sessionId),
        cancel: input.cancelUrl,
      });
      return { sessionId, url: `${config.appUrl.replace(/\/$/, "")}/checkout/fake-pay?${qs}` };
    },
    async parseWebhook(rawBody, headers) {
      const given = headers.get(FAKE_SIGNATURE_HEADER) ?? "";
      const expected = signFakeEvent(config.secret, rawBody);
      if (
        given.length !== expected.length ||
        !timingSafeEqual(Buffer.from(given), Buffer.from(expected))
      ) {
        throw new WebhookSignatureError();
      }
      return JSON.parse(rawBody) as PaymentEvent;
    },
    async refund() {
      return { refundId: `fr_${randomBytes(8).toString("hex")}`, status: "succeeded" };
    },
  };
}
