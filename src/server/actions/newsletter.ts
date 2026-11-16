"use server";

import { z } from "zod";

import { emailField } from "@/lib/schemas/auth";
import { db } from "@/server/db";
import { enforceRateLimit } from "@/server/rate-limit";
import { sendEmail } from "@/server/email";
import { UserError } from "@/server/errors";
import { unsubscribeUrl } from "@/server/notifications/newsletter";
import { subscribe, unsubscribeById } from "@/server/services/newsletter";
import { verifySignedValue } from "@/server/signed-links";

import { publicAction } from "./safe-action";

/** Footer and homepage signup. Same response whether or not the address was already subscribed (rule 13). */
export const subscribeAction = publicAction(z.object({ email: emailField }), async (input) => {
  await enforceRateLimit("newsletter");
  const { subscriber } = await subscribe(db, input.email);
  await sendEmail({
    template: "newsletter-welcome",
    to: subscriber.email,
    dedupeKey: `newsletter:${subscriber.id}`,
    props: { unsubscribeUrl: unsubscribeUrl(subscriber.id) },
  });
  return { ok: true };
});

/** S30: one click on the page confirms. GET never unsubscribes, so link scanners cannot. */
export const unsubscribeAction = publicAction(
  z.object({ s: z.string(), sig: z.string() }),
  async (input) => {
    if (!verifySignedValue("unsubscribe", input.s, input.sig))
      throw new UserError("This unsubscribe link is not valid.");
    await unsubscribeById(db, input.s);
    return { ok: true };
  },
);
