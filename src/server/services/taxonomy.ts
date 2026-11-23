import type { PrismaClient } from "@/generated/prisma/client";
import type { categorySchema, collectionSchema } from "@/lib/schemas/catalogue";
import { UserError, isUniqueConstraintError } from "@/server/errors";
import type { z } from "zod";

import { audit } from "./audit";

type CategoryData = z.output<typeof categorySchema>;
type CollectionData = z.output<typeof collectionSchema>;

function slugTaken(error: unknown): never {
  if (isUniqueConstraintError(error)) throw new UserError("That URL slug is already used.");
  throw error;
}

// Categories (A6) ------------------------------------------------------------

export async function saveCategory(prisma: PrismaClient, input: CategoryData, actorId: string) {
  try {
    const before = input.id ? await prisma.category.findUnique({ where: { id: input.id } }) : null;
    if (input.id && !before) throw new UserError("This category no longer exists.");
    const data = {
      name: input.name,
      slug: input.slug,
      description: input.description,
      imageId: input.imageId,
      taxCode: input.taxCode,
    };
    const after = before
      ? await prisma.category.update({ where: { id: before.id }, data })
      : await prisma.category.create({
          data: {
            ...data,
            position:
              ((await prisma.category.aggregate({ _max: { position: true } }))._max.position ??
                -1) + 1,
          },
        });
    await audit(prisma, {
      actorId,
      action: before ? "category.update" : "category.create",
      targetType: "Category",
      targetId: after.id,
      before,
      after,
    });
    return after;
  } catch (error) {
    slugTaken(error);
  }
}

export async function deleteCategory(prisma: PrismaClient, id: string, actorId: string) {
  const before = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });
  if (!before) throw new UserError("This category no longer exists.");
  if (before._count.products > 0) {
    throw new UserError(
      `Move the ${before._count.products} product(s) in this category to another category first.`,
    );
  }
  await prisma.category.delete({ where: { id } });
  await audit(prisma, {
    actorId,
    action: "category.delete",
    targetType: "Category",
    targetId: id,
    before,
  });
}

export async function reorder(
  prisma: PrismaClient,
  model: "category" | "collection",
  ids: string[],
  actorId: string,
) {
  await prisma.$transaction(
    ids.map((id, position) =>
      model === "category"
        ? prisma.category.update({ where: { id }, data: { position } })
        : prisma.collection.update({ where: { id }, data: { position } }),
    ),
  );
  await audit(prisma, {
    actorId,
    action: `${model}.reorder`,
    targetType: model === "category" ? "Category" : "Collection",
    after: { ids },
  });
}

// Collections (A7) -----------------------------------------------------------

export async function saveCollection(prisma: PrismaClient, input: CollectionData, actorId: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      const before = input.id
        ? await tx.collection.findUnique({
            where: { id: input.id },
            include: { products: { orderBy: { position: "asc" } } },
          })
        : null;
      if (input.id && !before) throw new UserError("This collection no longer exists.");
      const data = {
        name: input.name,
        slug: input.slug,
        description: input.description,
        bannerImageId: input.bannerImageId,
      };
      const after = before
        ? await tx.collection.update({ where: { id: before.id }, data })
        : await tx.collection.create({
            data: {
              ...data,
              position:
                ((await tx.collection.aggregate({ _max: { position: true } }))._max.position ??
                  -1) + 1,
            },
          });
      await tx.collectionProduct.deleteMany({ where: { collectionId: after.id } });
      if (input.productIds.length) {
        await tx.collectionProduct.createMany({
          data: [...new Set(input.productIds)].map((productId, position) => ({
            collectionId: after.id,
            productId,
            position,
          })),
        });
      }
      await audit(tx, {
        actorId,
        action: before ? "collection.update" : "collection.create",
        targetType: "Collection",
        targetId: after.id,
        before: before
          ? { ...before, productIds: before.products.map((p) => p.productId) }
          : undefined,
        after: { ...after, productIds: input.productIds },
      });
      return after;
    });
  } catch (error) {
    slugTaken(error);
  }
}

export async function deleteCollection(prisma: PrismaClient, id: string, actorId: string) {
  const before = await prisma.collection.findUnique({ where: { id } });
  if (!before) throw new UserError("This collection no longer exists.");
  await prisma.collection.delete({ where: { id } });
  await audit(prisma, {
    actorId,
    action: "collection.delete",
    targetType: "Collection",
    targetId: id,
    before,
  });
}
