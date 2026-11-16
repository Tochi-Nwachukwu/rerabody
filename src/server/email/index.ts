import "server-only";

import type { EmailTemplateName } from "@/emails/registry";
import { env } from "@/env";
import { db } from "@/server/db";

import { type EmailDeps, type SendEmailInput, type SendEmailResult, sendEmailWith } from "./send";
import { createLogTransport, createResendTransport } from "./transport";

let deps: EmailDeps | undefined;

function getDeps(): EmailDeps {
  deps ??= {
    prisma: db,
    transport:
      env.EMAIL_TRANSPORT === "log"
        ? createLogTransport()
        : createResendTransport(env.RESEND_API_KEY),
    from: { orders: env.EMAIL_FROM_ORDERS, marketing: env.EMAIL_FROM_MARKETING },
  };
  return deps;
}

/** sendEmail({ template, to, dedupeKey, props }). See send.ts for the dedupe rules. */
export function sendEmail<T extends EmailTemplateName>(
  input: SendEmailInput<T>,
): Promise<SendEmailResult> {
  return sendEmailWith(getDeps(), input);
}
