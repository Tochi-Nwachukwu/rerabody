"use server";

import { z } from "zod";

import { SECTION_TYPES } from "@/lib/home-sections";
import { TAGS, expireTags } from "@/server/cache-tags";
import { db } from "@/server/db";
import {
  addSection,
  discardHomepageDraft,
  duplicateSection,
  publishHomepage,
  removeSection,
  reorderSections,
  saveSectionDraft,
  setSectionVisibility,
} from "@/server/services/home-sections";

import { adminAction } from "./safe-action";

const P = "content.manage";

// Draft edits never touch the live homepage, so they do not revalidate it.
export const addSectionAction = adminAction(
  P,
  z.object({ type: z.enum(SECTION_TYPES as [string, ...string[]]) }),
  async (i, s) => ({ id: (await addSection(db, i.type as never, s.userId)).id }),
);
export const saveSectionDraftAction = adminAction(
  P,
  z.object({ id: z.string(), data: z.unknown() }),
  async (i, s) => {
    await saveSectionDraft(db, { id: i.id, data: i.data, actorId: s.userId });
  },
);
export const reorderSectionsAction = adminAction(
  P,
  z.object({ ids: z.array(z.string()).min(1).max(100) }),
  async (i, s) => reorderSections(db, i.ids, s.userId),
);
export const setSectionVisibilityAction = adminAction(
  P,
  z.object({ id: z.string(), visible: z.boolean() }),
  async (i, s) => setSectionVisibility(db, { ...i, actorId: s.userId }),
);
export const duplicateSectionAction = adminAction(
  P,
  z.object({ id: z.string() }),
  async (i, s) => ({ id: (await duplicateSection(db, i.id, s.userId)).id }),
);
export const removeSectionAction = adminAction(P, z.object({ id: z.string() }), async (i, s) =>
  removeSection(db, i.id, s.userId),
);
export const discardHomepageAction = adminAction(P, z.object({}), async (_i, s) =>
  discardHomepageDraft(db, s.userId),
);

export const publishHomepageAction = adminAction(P, z.object({}), async (_i, s) => {
  await publishHomepage(db, s.userId);
  expireTags(TAGS.home);
});
