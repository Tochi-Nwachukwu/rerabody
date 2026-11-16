"use server";

import { z } from "zod";

import { richTextSchema, slugSchema } from "@/lib/schemas/catalogue";
import { TAGS, expireTags } from "@/server/cache-tags";
import { db } from "@/server/db";
import {
  deleteFaq,
  deletePage,
  publishPage,
  reorderFaqs,
  saveFaq,
  savePageDraft,
  unpublishPage,
} from "@/server/services/content";

import { adminAction } from "./safe-action";

const P = "content.manage";
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable();

export const savePageAction = adminAction(
  P,
  z.object({
    id: z.string().optional(),
    slug: slugSchema,
    title: z.string().trim().min(1, "Enter a title").max(120),
    draftBody: richTextSchema,
    metaTitle: optional(70),
    metaDescription: optional(170),
  }),
  async (input, staff) => {
    const page = await savePageDraft(db, { ...input, actorId: staff.userId });
    // Title and meta are live immediately; the body goes live on publish.
    expireTags(TAGS.page(page.slug));
    return { id: page.id };
  },
);

export const publishPageAction = adminAction(
  P,
  z.object({ id: z.string() }),
  async (input, staff) => {
    const page = await publishPage(db, { ...input, actorId: staff.userId });
    expireTags(TAGS.page(page.slug));
  },
);

export const unpublishPageAction = adminAction(
  P,
  z.object({ id: z.string() }),
  async (input, staff) => {
    const page = await unpublishPage(db, { ...input, actorId: staff.userId });
    expireTags(TAGS.page(page.slug));
  },
);

export const deletePageAction = adminAction(
  P,
  z.object({ id: z.string() }),
  async (input, staff) => {
    const page = await deletePage(db, { ...input, actorId: staff.userId });
    if (page) expireTags(TAGS.page(page.slug));
  },
);

export const saveFaqAction = adminAction(
  P,
  z.object({
    id: z.string().optional(),
    topic: z.string().trim().min(1, "Enter a topic").max(60),
    question: z.string().trim().min(1, "Enter the question").max(300),
    answer: z.string().trim().min(1, "Enter the answer").max(4000),
  }),
  async (input, staff) => {
    const faq = await saveFaq(db, { ...input, actorId: staff.userId });
    expireTags(TAGS.faq);
    return { id: faq.id };
  },
);

export const deleteFaqAction = adminAction(
  P,
  z.object({ id: z.string() }),
  async (input, staff) => {
    await deleteFaq(db, { ...input, actorId: staff.userId });
    expireTags(TAGS.faq);
  },
);

export const reorderFaqsAction = adminAction(
  P,
  z.object({ ids: z.array(z.string()).min(1).max(500) }),
  async (input, staff) => {
    await reorderFaqs(db, input.ids, staff.userId);
    expireTags(TAGS.faq);
  },
);
