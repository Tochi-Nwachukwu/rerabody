import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { UserError, isUniqueConstraintError } from "@/server/errors";

import { audit } from "./audit";

/** Slugs that belong to app routes, so a CMS page can never shadow them. */
export const RESERVED_SLUGS = new Set([
  "shop",
  "collections",
  "products",
  "search",
  "offers",
  "cart",
  "checkout",
  "account",
  "orders",
  "login",
  "register",
  "verify-email",
  "forgot-password",
  "reset-password",
  "admin",
  "api",
  "faq",
  "contact",
  "journal",
  "unsubscribe",
  "preview",
  "reviews",
  "sitemap.xml",
  "robots.txt",
]);
export const SYSTEM_PAGES = new Set(["terms", "privacy", "shipping-returns"]);

const json = (v: unknown) =>
  v === null || v === undefined ? Prisma.DbNull : (v as Prisma.InputJsonValue);

// Pages (A21) ------------------------------------------------------------------

export async function savePageDraft(
  prisma: PrismaClient,
  input: {
    id?: string;
    slug: string;
    title: string;
    draftBody: unknown;
    metaTitle: string | null;
    metaDescription: string | null;
    actorId: string;
  },
) {
  if (RESERVED_SLUGS.has(input.slug))
    throw new UserError("That URL is used by another part of the store. Choose a different slug.");
  const before = input.id ? await prisma.page.findUnique({ where: { id: input.id } }) : null;
  if (input.id && !before) throw new UserError("This page no longer exists.");
  if (before && SYSTEM_PAGES.has(before.slug) && before.slug !== input.slug)
    throw new UserError("The address of this page cannot change.");
  try {
    const data = {
      slug: input.slug,
      title: input.title,
      draftBody: json(input.draftBody),
      metaTitle: input.metaTitle,
      metaDescription: input.metaDescription,
    };
    const page = before
      ? await prisma.page.update({ where: { id: before.id }, data })
      : await prisma.page.create({ data });
    await audit(prisma, {
      actorId: input.actorId,
      action: before ? "page.update" : "page.create",
      targetType: "Page",
      targetId: page.id,
      before,
      after: page,
    });
    return page;
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new UserError("Another page already uses that slug.");
    throw error;
  }
}

export async function publishPage(prisma: PrismaClient, input: { id: string; actorId: string }) {
  const page = await prisma.page.findUnique({ where: { id: input.id } });
  if (!page) throw new UserError("This page no longer exists.");
  const body = page.draftBody ?? page.body;
  if (!body) throw new UserError("Write something before publishing.");
  const after = await prisma.page.update({
    where: { id: page.id },
    data: {
      body: body as Prisma.InputJsonValue,
      draftBody: Prisma.DbNull,
      publishedAt: new Date(),
    },
  });
  await audit(prisma, {
    actorId: input.actorId,
    action: "page.publish",
    targetType: "Page",
    targetId: page.id,
    before: { body: page.body },
    after: { body: after.body },
  });
  return after;
}

export async function unpublishPage(prisma: PrismaClient, input: { id: string; actorId: string }) {
  const page = await prisma.page.update({ where: { id: input.id }, data: { publishedAt: null } });
  await audit(prisma, {
    actorId: input.actorId,
    action: "page.unpublish",
    targetType: "Page",
    targetId: page.id,
  });
  return page;
}

export async function deletePage(prisma: PrismaClient, input: { id: string; actorId: string }) {
  const page = await prisma.page.findUnique({ where: { id: input.id } });
  if (!page) return null;
  if (SYSTEM_PAGES.has(page.slug))
    throw new UserError("Terms, privacy and shipping pages cannot be deleted. Edit them instead.");
  await prisma.page.delete({ where: { id: page.id } });
  await audit(prisma, {
    actorId: input.actorId,
    action: "page.delete",
    targetType: "Page",
    targetId: page.id,
    before: page,
  });
  return page;
}

// FAQ (A22) --------------------------------------------------------------------

export async function saveFaq(
  prisma: PrismaClient,
  input: { id?: string; topic: string; question: string; answer: string; actorId: string },
) {
  const before = input.id ? await prisma.faq.findUnique({ where: { id: input.id } }) : null;
  if (input.id && !before) throw new UserError("This question no longer exists.");
  const data = { topic: input.topic, question: input.question, answer: input.answer };
  const faq = before
    ? await prisma.faq.update({ where: { id: before.id }, data })
    : await prisma.faq.create({
        data: {
          ...data,
          position:
            ((await prisma.faq.aggregate({ _max: { position: true } }))._max.position ?? -1) + 1,
        },
      });
  await audit(prisma, {
    actorId: input.actorId,
    action: before ? "faq.update" : "faq.create",
    targetType: "Faq",
    targetId: faq.id,
    before,
    after: faq,
  });
  return faq;
}

export async function deleteFaq(prisma: PrismaClient, input: { id: string; actorId: string }) {
  const before = await prisma.faq.delete({ where: { id: input.id } });
  await audit(prisma, {
    actorId: input.actorId,
    action: "faq.delete",
    targetType: "Faq",
    targetId: input.id,
    before,
  });
}

export async function reorderFaqs(prisma: PrismaClient, ids: string[], actorId: string) {
  await prisma.$transaction(
    ids.map((id, position) => prisma.faq.update({ where: { id }, data: { position } })),
  );
  await audit(prisma, { actorId, action: "faq.reorder", targetType: "Faq", after: { ids } });
}
