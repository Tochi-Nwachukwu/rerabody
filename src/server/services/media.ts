import type { PrismaClient } from "@/generated/prisma/client";
import { MAX_UPLOAD_BYTES, MEDIA_KEY_PATTERN, isAllowedImageType } from "@/lib/media";
import { UserError } from "@/server/errors";
import type { StorageDriver } from "@/server/storage/types";

import { audit } from "./audit";

export async function registerUpload(
  prisma: PrismaClient,
  storage: StorageDriver,
  input: {
    key: string;
    width?: number | null;
    height?: number | null;
    alt?: string | null;
    actorId: string;
  },
) {
  if (!MEDIA_KEY_PATTERN.test(input.key)) throw new UserError("That upload key is not valid.");
  const existing = await prisma.media.findUnique({ where: { key: input.key } });
  if (existing) return existing;

  const head = await storage.head(input.key);
  if (!head) throw new UserError("The upload did not finish. Please try again.");
  const contentType = head.contentType ?? "";
  if (head.contentLength > MAX_UPLOAD_BYTES || !isAllowedImageType(contentType)) {
    await storage.delete(input.key);
    throw new UserError("Images must be JPEG, PNG or WebP and 8 MB or smaller.");
  }

  const media = await prisma.media.create({
    data: {
      key: input.key,
      url: storage.publicUrl(input.key),
      width: input.width ?? null,
      height: input.height ?? null,
      bytes: head.contentLength,
      mimeType: contentType,
      alt: input.alt?.trim() || null,
    },
  });
  await audit(prisma, {
    actorId: input.actorId,
    action: "media.upload",
    targetType: "Media",
    targetId: media.id,
    after: media,
  });
  return media;
}

/** Everything that still points at a media item. Rule 11: it cannot be deleted while this is non-empty. */
export async function findMediaReferences(
  prisma: PrismaClient,
  mediaId: string,
): Promise<string[]> {
  const [categories, collections, productImages, variants, posts] = await Promise.all([
    prisma.category.findMany({ where: { imageId: mediaId }, select: { name: true } }),
    prisma.collection.findMany({ where: { bannerImageId: mediaId }, select: { name: true } }),
    prisma.productImage.findMany({
      where: { mediaId },
      select: { product: { select: { name: true } } },
    }),
    prisma.productVariant.findMany({ where: { imageId: mediaId }, select: { sku: true } }),
    prisma.blogPost.findMany({ where: { coverImageId: mediaId }, select: { title: true } }),
  ]);
  // JSON references: homepage sections (published and draft) and site settings.
  const needle = `%${mediaId}%`;
  const [sections, settings] = await Promise.all([
    prisma.$queryRaw<{ type: string }[]>`
      SELECT "type"::text AS type FROM "HomeSection"
      WHERE "data"::text LIKE ${needle} OR "draftData"::text LIKE ${needle}`,
    prisma.$queryRaw<
      { key: string }[]
    >`SELECT "key" FROM "SiteSetting" WHERE "value"::text LIKE ${needle}`,
  ]);

  return [
    ...categories.map((c) => `Category: ${c.name}`),
    ...collections.map((c) => `Collection: ${c.name}`),
    ...productImages.map((p) => `Product: ${p.product.name}`),
    ...variants.map((v) => `Variant: ${v.sku}`),
    ...posts.map((p) => `Journal post: ${p.title}`),
    ...sections.map((s) => `Homepage section: ${s.type.toLowerCase().replaceAll("_", " ")}`),
    ...settings.map((s) => `Setting: ${s.key}`),
  ];
}

export async function deleteMedia(
  prisma: PrismaClient,
  storage: StorageDriver,
  input: { mediaId: string; actorId: string },
) {
  const media = await prisma.media.findUnique({ where: { id: input.mediaId } });
  if (!media) throw new UserError("That image no longer exists.");
  const refs = await findMediaReferences(prisma, media.id);
  if (refs.length > 0) {
    throw new UserError(
      `This image is in use and cannot be deleted. Used by: ${[...new Set(refs)].join(", ")}.`,
    );
  }
  try {
    await prisma.media.delete({ where: { id: media.id } });
  } catch (error) {
    // Foreign keys use onDelete: Restrict, so a reference added since the check above still blocks it.
    if ((error as { code?: string }).code === "P2003")
      throw new UserError("This image is in use and cannot be deleted.");
    throw error;
  }
  await storage
    .delete(media.key)
    .catch((e) => console.error(`[media] could not delete object ${media.key}`, e));
  await audit(prisma, {
    actorId: input.actorId,
    action: "media.delete",
    targetType: "Media",
    targetId: media.id,
    before: media,
  });
}

export async function updateMediaAlt(
  prisma: PrismaClient,
  input: { mediaId: string; alt: string; actorId: string },
) {
  const before = await prisma.media.findUnique({ where: { id: input.mediaId } });
  if (!before) throw new UserError("That image no longer exists.");
  const after = await prisma.media.update({
    where: { id: input.mediaId },
    data: { alt: input.alt.trim() || null },
  });
  await audit(prisma, {
    actorId: input.actorId,
    action: "media.update",
    targetType: "Media",
    targetId: after.id,
    before,
    after,
  });
  return after;
}

export const MEDIA_PAGE_SIZE = 24;

export async function listMedia(prisma: PrismaClient, input: { q?: string; page?: number }) {
  const page = Math.max(1, input.page ?? 1);
  const where = input.q
    ? {
        OR: [
          { alt: { contains: input.q, mode: "insensitive" as const } },
          { key: { contains: input.q } },
        ],
      }
    : {};
  const [items, total] = await Promise.all([
    prisma.media.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * MEDIA_PAGE_SIZE,
      take: MEDIA_PAGE_SIZE,
    }),
    prisma.media.count({ where }),
  ]);
  return { items, total, page, pageCount: Math.max(1, Math.ceil(total / MEDIA_PAGE_SIZE)) };
}
