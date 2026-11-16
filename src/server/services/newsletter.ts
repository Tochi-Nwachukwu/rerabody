import type { PrismaClient } from "@/generated/prisma/client";
import { generateToken, hashToken, tokenMatchesHash } from "@/server/tokens";

/**
 * Subscribes an address. Returns the subscriber and whether a welcome email
 * should go out. The caller responds the same either way (rule 13).
 */
export async function subscribe(prisma: PrismaClient, email: string) {
  const normalised = email.trim().toLowerCase();
  const existing = await prisma.newsletterSubscriber.findUnique({ where: { email: normalised } });
  if (existing) {
    if (existing.status !== "SUBSCRIBED") {
      await prisma.newsletterSubscriber.update({
        where: { id: existing.id },
        data: { status: "SUBSCRIBED" },
      });
    }
    return { subscriber: existing, isNew: false };
  }
  const subscriber = await prisma.newsletterSubscriber.create({
    data: { email: normalised, tokenHash: hashToken(generateToken()) },
  });
  return { subscriber, isNew: true };
}

export async function unsubscribeById(prisma: PrismaClient, id: string) {
  const res = await prisma.newsletterSubscriber.updateMany({
    where: { id, status: "SUBSCRIBED" },
    data: { status: "UNSUBSCRIBED" },
  });
  return res.count > 0;
}

export async function findSubscriberByToken(prisma: PrismaClient, id: string, token: string) {
  const s = await prisma.newsletterSubscriber.findUnique({ where: { id } });
  return s && tokenMatchesHash(token, s.tokenHash) ? s : null;
}
