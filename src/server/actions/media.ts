"use server";

import { z } from "zod";

import { db } from "@/server/db";
import { deleteMedia, listMedia, registerUpload, updateMediaAlt } from "@/server/services/media";
import { getStorage } from "@/server/storage";

import { adminAction } from "./safe-action";

export const registerUploadAction = adminAction(
  "media.upload",
  z.object({
    key: z.string(),
    width: z.number().int().positive().nullish(),
    height: z.number().int().positive().nullish(),
    alt: z.string().max(300).nullish(),
  }),
  async (input, staff) => {
    const m = await registerUpload(db, getStorage(), { ...input, actorId: staff.userId });
    return { id: m.id, url: m.url, alt: m.alt, width: m.width, height: m.height };
  },
);

export const deleteMediaAction = adminAction(
  "media.delete",
  z.object({ mediaId: z.string() }),
  async (input, staff) => {
    await deleteMedia(db, getStorage(), { mediaId: input.mediaId, actorId: staff.userId });
  },
);

export const updateMediaAltAction = adminAction(
  "media.upload",
  z.object({ mediaId: z.string(), alt: z.string().max(300) }),
  async (input, staff) => {
    await updateMediaAlt(db, { ...input, actorId: staff.userId });
  },
);

/** Media picker search. Readable by anyone who can upload or edit content. */
export const listMediaAction = adminAction(
  "media.upload",
  z.object({ q: z.string().max(100).optional(), page: z.number().int().min(1).optional() }),
  async (input) => {
    const res = await listMedia(db, input);
    return {
      ...res,
      items: res.items.map((m) => ({
        id: m.id,
        url: m.url,
        alt: m.alt,
        width: m.width,
        height: m.height,
      })),
    };
  },
);
