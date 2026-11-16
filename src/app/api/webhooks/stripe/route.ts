import { NextResponse } from "next/server";

import { db } from "@/server/db";
import { afterPaymentOutcome } from "@/server/order-effects";
import { getStripeProvider } from "@/server/payments";
import { WebhookSignatureError } from "@/server/payments/types";
import { handlePaymentEvent } from "@/server/services/payment-webhook";

/** Stripe webhook. The only place an order becomes PAID (rule 1). */
export async function POST(request: Request) {
  const rawBody = await request.text();
  let event;
  try {
    event = await getStripeProvider().parseWebhook(rawBody, request.headers);
  } catch (error) {
    if (error instanceof WebhookSignatureError)
      return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
  const outcome = await handlePaymentEvent(db, "stripe", event);
  await afterPaymentOutcome(outcome);
  return NextResponse.json({ received: true, outcome: outcome.status });
}
