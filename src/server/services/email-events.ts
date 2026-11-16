import type { PrismaClient } from "@/generated/prisma/client";
import { isUniqueConstraintError } from "@/server/errors";

export type EmailProviderEvent = { id: string; type: string; emailId: string; to: string[] };

/**
 * Records delivery outcomes from Resend. Bounces and complaints stop
 * marketing mail to that address. Idempotent by event id.
 */
export async function handleEmailEvent(prisma: PrismaClient, event: EmailProviderEvent) {
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.processedWebhookEvent.create({ data: { provider: "resend", eventId: event.id } });
      const status =
        event.type === "email.bounced"
          ? "BOUNCED"
          : event.type === "email.complained"
            ? "COMPLAINED"
            : event.type === "email.delivered"
              ? "DELIVERED"
              : event.type === "email.failed"
                ? "FAILED"
                : null;
      if (!status) return { status: "ignored" as const };
      await tx.emailLog.updateMany({ where: { providerId: event.emailId }, data: { status } });
      if (status === "BOUNCED" || status === "COMPLAINED") {
        const emails = event.to.map((t) => t.toLowerCase());
        await tx.newsletterSubscriber.updateMany({
          where: { email: { in: emails } },
          data: { status: "BOUNCED" },
        });
      }
      return { status: "processed" as const, emailStatus: status };
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) return { status: "duplicate" as const };
    throw error;
  }
}
