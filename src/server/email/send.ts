import { render } from "@react-email/render";
import { type ComponentType, createElement } from "react";

import { type EmailTemplateName, type EmailTemplateProps, emailTemplates } from "@/emails/registry";
import type { PrismaClient } from "@/generated/prisma/client";
import { isUniqueConstraintError } from "@/server/errors";

import type { EmailTransport } from "./transport";

export type SendEmailInput<T extends EmailTemplateName> = {
  template: T;
  to: string;
  /** Unique per logical email, e.g. `{orderId}:PAID`. Omit for emails that always send. */
  dedupeKey?: string;
  props: EmailTemplateProps<T>;
  replyTo?: string;
};

export type SendEmailResult =
  | { status: "sent"; logId: string; providerId: string }
  | { status: "duplicate"; logId: string }
  | { status: "suppressed"; logId: string }
  | { status: "failed"; logId: string; error: string };

export type EmailDeps = {
  prisma: PrismaClient;
  transport: EmailTransport;
  from: { orders: string; marketing: string };
};

/**
 * Sends one email and records it in EmailLog.
 *
 * Call it after the database transaction commits, never inside one (rule 6).
 * The EmailLog row is inserted first. If the dedupe key already exists the
 * send is skipped, unless the earlier attempt failed, in which case it retries.
 * Never throws for delivery problems: failures are logged and returned.
 */
export async function sendEmailWith<T extends EmailTemplateName>(
  deps: EmailDeps,
  input: SendEmailInput<T>,
): Promise<SendEmailResult> {
  const def = emailTemplates[input.template];
  const to = input.to.trim().toLowerCase();

  let logId: string;
  try {
    const log = await deps.prisma.emailLog.create({
      data: { to, template: input.template, dedupeKey: input.dedupeKey ?? null, status: "PENDING" },
    });
    logId = log.id;
  } catch (error) {
    if (!input.dedupeKey || !isUniqueConstraintError(error)) throw error;
    const existing = await deps.prisma.emailLog.findUnique({
      where: { dedupeKey: input.dedupeKey },
    });
    if (!existing) throw error;
    if (existing.status !== "FAILED") return { status: "duplicate", logId: existing.id };
    // Claim the failed row for a retry. Only one concurrent caller wins the update.
    const claimed = await deps.prisma.emailLog.updateMany({
      where: { id: existing.id, status: "FAILED" },
      data: { status: "PENDING", error: null },
    });
    if (claimed.count === 0) return { status: "duplicate", logId: existing.id };
    logId = existing.id;
  }

  if (def.stream === "marketing") {
    const subscriber = await deps.prisma.newsletterSubscriber.findUnique({ where: { email: to } });
    if (subscriber && subscriber.status !== "SUBSCRIBED") {
      await deps.prisma.emailLog.update({
        where: { id: logId },
        data: { status: "FAILED", error: `Suppressed: subscriber is ${subscriber.status}` },
      });
      return { status: "suppressed", logId };
    }
  }

  try {
    // The registry maps each template name to its own props type; TypeScript cannot
    // correlate the two through the lookup, so widen the component here.
    const Component = def.component as ComponentType<Record<string, unknown>>;
    const props = input.props;
    const element = createElement(Component, props as Record<string, unknown>);
    const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
    const subject = (def.subject as (p: EmailTemplateProps<T>) => string)(props);

    const result = await deps.transport.send({
      from: def.stream === "marketing" ? deps.from.marketing : deps.from.orders,
      to,
      subject,
      html,
      text,
      replyTo: input.replyTo,
    });
    await deps.prisma.emailLog.update({
      where: { id: logId },
      data: { status: "SENT", providerId: result.id, error: null },
    });
    return { status: "sent", logId, providerId: result.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await deps.prisma.emailLog.update({
      where: { id: logId },
      data: { status: "FAILED", error: message },
    });
    console.error(`[email] ${input.template} to ${to} failed: ${message}`);
    return { status: "failed", logId, error: message };
  }
}
