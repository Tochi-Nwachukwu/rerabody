import "server-only";

import { env } from "@/env";

import { createFakeProvider } from "./fake";
import { createStripeProvider } from "./stripe";
import type { PaymentProvider } from "./types";

let active: PaymentProvider | undefined;
let stripe: PaymentProvider | undefined;

/** The provider used for new checkouts and refunds. */
export function getPaymentProvider(): PaymentProvider {
  active ??= env.PAYMENT_PROVIDER === "fake" ? getFakeProvider() : getStripeProvider();
  return active;
}

export function getStripeProvider(): PaymentProvider {
  stripe ??= createStripeProvider({
    secretKey: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    automaticTax: env.STRIPE_AUTOMATIC_TAX,
  });
  return stripe;
}

export function getFakeProvider(): PaymentProvider {
  if (env.PAYMENT_PROVIDER !== "fake") throw new Error("The fake payment provider is disabled");
  return createFakeProvider({ secret: env.BETTER_AUTH_SECRET, appUrl: env.NEXT_PUBLIC_APP_URL });
}

/** Provider that created a payment, for refunds of older orders. */
export function getProviderByName(name: string): PaymentProvider {
  if (name === "fake") return getFakeProvider();
  return getStripeProvider();
}

export type { PaymentProvider };
