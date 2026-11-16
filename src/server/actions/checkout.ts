"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { env } from "@/env";
import { checkoutSchema } from "@/lib/schemas/checkout";
import { formatStoreMoney, getCartIdentity } from "@/server/cart-session";
import { db } from "@/server/db";
import { UserError } from "@/server/errors";
import { afterPaymentOutcome } from "@/server/order-effects";
import { getFakeProvider, getPaymentProvider } from "@/server/payments";
import { FAKE_SIGNATURE_HEADER, signFakeEvent } from "@/server/payments/fake";
import type { PaymentEvent } from "@/server/payments/types";
import { createOrderFromCart } from "@/server/services/checkout";
import { handlePaymentEvent } from "@/server/services/payment-webhook";

import { publicAction } from "./safe-action";

/** S9 "Pay now": creates the PENDING_PAYMENT order and returns the hosted payment page URL. */
export const startCheckoutAction = publicAction(checkoutSchema, async (input) => {
  const identity = await getCartIdentity();
  const { url } = await createOrderFromCart(db, getPaymentProvider(), {
    identity,
    userId: identity.userId,
    email: identity.email ?? input.email,
    address: input.address,
    shippingMethodId: input.shippingMethodId,
    saveAddress: input.saveAddress,
    currency: env.STORE_CURRENCY,
    appUrl: env.NEXT_PUBLIC_APP_URL,
    now: new Date(),
    format: formatStoreMoney,
  });
  return { url };
});

/**
 * Fake provider only: simulates the customer paying, cancelling or the session
 * expiring by sending a signed event through the same webhook pipeline as Stripe.
 */
export const fakePayAction = publicAction(
  z.object({
    session: z.string().startsWith("fs_"),
    outcome: z.enum(["pay", "fail", "expire"]),
    success: z.string(),
    cancel: z.string(),
  }),
  async (input) => {
    if (env.PAYMENT_PROVIDER !== "fake") throw new UserError("The test payment page is disabled.");
    const payment = await db.payment.findUnique({
      where: { providerSessionId: input.session },
      include: { order: { select: { total: true } } },
    });
    if (!payment) throw new UserError("Unknown test payment session.");
    const eventId = `evt_fake_${input.session}_${input.outcome}`;
    const event: PaymentEvent =
      input.outcome === "pay"
        ? {
            kind: "checkout.completed",
            eventId,
            sessionId: input.session,
            paymentId: `pi_fake_${input.session}`,
            amountTotal: payment.order.total,
          }
        : input.outcome === "fail"
          ? { kind: "checkout.failed", eventId, sessionId: input.session }
          : { kind: "checkout.expired", eventId, sessionId: input.session };
    const body = JSON.stringify(event);
    const headers = new Headers({
      [FAKE_SIGNATURE_HEADER]: signFakeEvent(env.BETTER_AUTH_SECRET, body),
    });
    const verified = await getFakeProvider().parseWebhook(body, headers);
    const outcome = await handlePaymentEvent(db, "fake", verified);
    await afterPaymentOutcome(outcome);
    const app = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
    const target = input.outcome === "pay" ? input.success : input.cancel;
    if (!target.startsWith(app)) throw new UserError("Invalid return address.");
    redirect(target.slice(app.length) || "/");
  },
);
