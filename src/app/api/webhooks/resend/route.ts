import { NextResponse } from "next/server";
import { Resend } from "resend";

import { env } from "@/env";
import { db } from "@/server/db";
import { handleEmailEvent } from "@/server/services/email-events";

/** Resend webhook: delivery, bounce and complaint events (signed with Svix). */
export async function POST(request: Request) {
  const payload = await request.text();
  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");
  if (!id || !timestamp || !signature)
    return NextResponse.json({ error: "Missing signature headers" }, { status: 400 });

  let event: { type: string; data?: { email_id?: string; to?: string[] } };
  try {
    event = new Resend(env.RESEND_API_KEY).webhooks.verify({
      payload,
      headers: { id, timestamp, signature },
      webhookSecret: env.RESEND_WEBHOOK_SECRET,
    }) as typeof event;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  const outcome = await handleEmailEvent(db, {
    id,
    type: event.type,
    emailId: event.data?.email_id ?? "",
    to: event.data?.to ?? [],
  });
  return NextResponse.json({ received: true, outcome: outcome.status });
}
