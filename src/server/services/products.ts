import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import type { ProductData } from "@/lib/schemas/catalogue";
import { UserError, isUniqueConstraintError, uniqueViolationOn } from "@/server/errors";

import { audit } from "./audit";

const json = (v: unknown) =>
  v === null || v === undefined ? Prisma.DbNull : (v as Prisma.InputJsonValue);

export type SaveProductResult = { id: string; slug: string; collectionIds: string[] };

/**
 * Creates or updates a product with its images, options, variants and collections.
 * Stock on existing variants is never changed here: it moves only through inventory adjustments.
 */
export async function saveProduct(
  prisma: PrismaClient,
  input: ProductData,
  actorId: string,
): Promise<SaveProductResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      const before = input.id
        ? await tx.product.findUnique({
            where: { id: input.id },
            include: { variants: true, options: true, images: true, collections: true },
          })
        : null;
      if (input.id && !before) throw new UserError("This product no longer exists.");

      const fields = {
        name: input.name,
        slug: input.slug,
        status: input.status,
        categoryId: input.categoryId,
        description: json(input.description),
        specs: json(input.specs),
        sizeGuide: json(input.sizeGuide),
        metaTitle: input.metaTitle,
        metaDescription: input.metaDescription,
      };
      const product = before
        ? await tx.product.update({ where: { id: before.id }, data: fields })
        : await tx.product.create({ data: fields });

      // Images: replace in the given order with exactly one cover.
      await tx.productImage.deleteMany({ where: { productId: product.id } });
      const coverIndex = Math.max(
        0,
        input.images.findIndex((i) => i.isCover),
      );
      if (input.images.length) {
        await tx.productImage.createMany({
          data: input.images.map((img, position) => ({
            productId: product.id,
            mediaId: img.mediaId,
            position,
            isCover: position === coverIndex,
          })),
        });
      }

      // Options: replace.
      await tx.productOption.deleteMany({ where: { productId: product.id } });
      if (input.options.length) {
        await tx.productOption.createMany({
          data: input.options.map((o, position) => ({
            productId: product.id,
            name: o.name,
            values: o.values,
            position,
          })),
        });
      }

      // Collections: keep existing positions, add new ones at the end.
      const currentCollections = before?.collections.map((c) => c.collectionId) ?? [];
      await tx.collectionProduct.deleteMany({
        where: { productId: product.id, collectionId: { notIn: input.collectionIds } },
      });
      for (const collectionId of input.collectionIds.filter(
        (id) => !currentCollections.includes(id),
      )) {
        const last = await tx.collectionProduct.aggregate({
          where: { collectionId },
          _max: { position: true },
        });
        await tx.collectionProduct.create({
          data: { collectionId, productId: product.id, position: (last._max.position ?? -1) + 1 },
        });
      }

      // Variants.
      const existing = new Map((before?.variants ?? []).map((v) => [v.id, v]));
      const keptIds = new Set<string>();
      // Free up SKUs first so swapping SKUs between variants does not hit the unique index.
      for (const v of input.variants) {
        if (v.id && existing.has(v.id)) {
          await tx.productVariant.update({ where: { id: v.id }, data: { sku: `__tmp_${v.id}` } });
        }
      }
      for (const v of input.variants) {
        const data = {
          sku: v.sku,
          optionValues: v.optionValues,
          price: v.price,
          compareAtPrice: v.compareAtPrice,
          lowStockThreshold: v.lowStockThreshold,
          imageId: v.imageId,
          isActive: v.isActive,
        };
        if (v.id) {
          if (!existing.has(v.id))
            throw new UserError("A variant does not belong to this product. Reload and try again.");
          await tx.productVariant.update({ where: { id: v.id }, data });
          keptIds.add(v.id);
        } else {
          const created = await tx.productVariant.create({
            data: { ...data, productId: product.id, stock: v.initialStock },
          });
          keptIds.add(created.id);
          if (v.initialStock > 0) {
            await tx.inventoryMovement.create({
              data: {
                variantId: created.id,
                delta: v.initialStock,
                reason: "RESTOCK",
                note: "Initial stock",
                actorId,
              },
            });
          }
        }
      }
      // Removed variants: delete unless they appear on orders, then deactivate to keep history.
      for (const [id, v] of existing) {
        if (keptIds.has(id)) continue;
        const used = await tx.orderItem.count({ where: { variantId: id } });
        if (used > 0) {
          await tx.productVariant.update({
            where: { id },
            data: { isActive: false, sku: `${v.sku}-RETIRED-${id.slice(-6)}` },
          });
        } else {
          await tx.productVariant.delete({ where: { id } });
        }
      }

      if (input.status === "PUBLISHED") {
        const active = await tx.productVariant.count({
          where: { productId: product.id, isActive: true },
        });
        if (active === 0)
          throw new UserError("A published product needs at least one active variant.");
      }

      await audit(tx, {
        actorId,
        action: before ? "product.update" : "product.create",
        targetType: "Product",
        targetId: product.id,
        before: before ?? undefined,
        after: { ...input, id: product.id },
      });

      return {
        id: product.id,
        slug: product.slug,
        collectionIds: [...new Set([...currentCollections, ...input.collectionIds])],
      };
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new UserError(
        uniqueViolationOn(error, "sku")
          ? "A SKU is already used by another product."
          : "That URL slug is already used.",
      );
    }
    throw error;
  }
}

export async function setProductStatus(
  prisma: PrismaClient,
  input: { id: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED"; actorId: string },
) {
  const before = await prisma.product.findUnique({
    where: { id: input.id },
    include: { variants: { where: { isActive: true }, select: { id: true } } },
  });
  if (!before) throw new UserError("This product no longer exists.");
  if (input.status === "PUBLISHED" && before.variants.length === 0) {
    throw new UserError("A published product needs at least one active variant.");
  }
  const after = await prisma.product.update({
    where: { id: input.id },
    data: { status: input.status },
  });
  await audit(prisma, {
    actorId: input.actorId,
    action: "product.status",
    targetType: "Product",
    targetId: after.id,
    before: { status: before.status },
    after: { status: after.status },
  });
  return after;
}

/** Hard delete is only allowed for products that were never ordered. Others are archived. */
export async function deleteProduct(prisma: PrismaClient, input: { id: string; actorId: string }) {
  const product = await prisma.product.findUnique({
    where: { id: input.id },
    include: { collections: true },
  });
  if (!product) throw new UserError("This product no longer exists.");
  const ordered = await prisma.orderItem.count({
    where: { OR: [{ productId: product.id }, { variant: { productId: product.id } }] },
  });
  if (ordered > 0)
    throw new UserError("This product has orders, so it cannot be deleted. Archive it instead.");
  await prisma.product.delete({ where: { id: product.id } });
  await audit(prisma, {
    actorId: input.actorId,
    action: "product.delete",
    targetType: "Product",
    targetId: product.id,
    before: product,
  });
  return { collectionIds: product.collections.map((c) => c.collectionId) };
}

export const ADMIN_PAGE_SIZE = 25;

export async function listProductsAdmin(
  prisma: PrismaClient,
  input: {
    q?: string;
    status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    categoryId?: string;
    page?: number;
  },
) {
  const page = Math.max(1, input.page ?? 1);
  const where: Prisma.ProductWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    ...(input.q
      ? {
          OR: [
            { name: { contains: input.q, mode: "insensitive" } },
            { variants: { some: { sku: { contains: input.q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      include: {
        category: { select: { name: true } },
        images: {
          where: { isCover: true },
          take: 1,
          include: { media: { select: { url: true, alt: true } } },
        },
        variants: { select: { price: true, stock: true, isActive: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);
  return {
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)),
    items: rows.map((p) => {
      const active = p.variants.filter((v) => v.isActive);
      const prices = active.map((v) => v.price);
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        status: p.status,
        category: p.category?.name ?? null,
        cover: p.images[0]?.media ?? null,
        variantCount: active.length,
        stock: active.reduce((s, v) => s + v.stock, 0),
        minPrice: prices.length ? Math.min(...prices) : null,
        maxPrice: prices.length ? Math.max(...prices) : null,
        updatedAt: p.updatedAt,
      };
    }),
  };
}

export async function getProductForEdit(prisma: PrismaClient, id: string) {
  return prisma.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: { position: "asc" }, include: { media: true } },
      options: { orderBy: { position: "asc" } },
      variants: { orderBy: { createdAt: "asc" } },
      collections: { select: { collectionId: true } },
    },
  });
}
