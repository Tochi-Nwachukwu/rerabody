"use server";

import { z } from "zod";

import {
  categorySchema,
  collectionSchema,
  productSchema,
  reorderSchema,
  stockAdjustSchema,
} from "@/lib/schemas/catalogue";
import { TAGS, expireTags } from "@/server/cache-tags";
import { db } from "@/server/db";
import { adjustStock, listMovements } from "@/server/services/inventory";
import { deleteProduct, saveProduct, setProductStatus } from "@/server/services/products";
import {
  deleteCategory,
  deleteCollection,
  reorder,
  saveCategory,
  saveCollection,
} from "@/server/services/taxonomy";

import { adminAction } from "./safe-action";

const storefrontTags = (productId: string, collectionIds: string[] = []) => [
  TAGS.products,
  TAGS.product(productId),
  TAGS.home,
  TAGS.offers,
  TAGS.collections,
  ...collectionIds.map(TAGS.collection),
];

// Products (A4, A5) ----------------------------------------------------------

export const saveProductAction = adminAction(
  "products.write",
  productSchema,
  async (input, staff) => {
    const result = await saveProduct(db, input, staff.userId);
    expireTags(...storefrontTags(result.id, result.collectionIds));
    return { id: result.id };
  },
);

export const setProductStatusAction = adminAction(
  "products.write",
  z.object({ id: z.string(), status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]) }),
  async (input, staff) => {
    await setProductStatus(db, { ...input, actorId: staff.userId });
    const collections = await db.collectionProduct.findMany({
      where: { productId: input.id },
      select: { collectionId: true },
    });
    expireTags(
      ...storefrontTags(
        input.id,
        collections.map((c) => c.collectionId),
      ),
    );
  },
);

export const deleteProductAction = adminAction(
  "products.write",
  z.object({ id: z.string() }),
  async (input, staff) => {
    const { collectionIds } = await deleteProduct(db, { id: input.id, actorId: staff.userId });
    expireTags(...storefrontTags(input.id, collectionIds));
  },
);

// Categories (A6) ------------------------------------------------------------

export const saveCategoryAction = adminAction(
  "products.write",
  categorySchema,
  async (input, staff) => {
    const c = await saveCategory(db, input, staff.userId);
    expireTags(TAGS.categories, TAGS.products);
    return { id: c.id };
  },
);

export const deleteCategoryAction = adminAction(
  "products.write",
  z.object({ id: z.string() }),
  async (input, staff) => {
    await deleteCategory(db, input.id, staff.userId);
    expireTags(TAGS.categories, TAGS.products);
  },
);

export const reorderCategoriesAction = adminAction(
  "products.write",
  reorderSchema,
  async (input, staff) => {
    await reorder(db, "category", input.ids, staff.userId);
    expireTags(TAGS.categories);
  },
);

// Collections (A7) -----------------------------------------------------------

export const saveCollectionAction = adminAction(
  "products.write",
  collectionSchema,
  async (input, staff) => {
    const c = await saveCollection(db, input, staff.userId);
    expireTags(TAGS.collections, TAGS.collection(c.id), TAGS.home, TAGS.products);
    return { id: c.id };
  },
);

export const deleteCollectionAction = adminAction(
  "products.write",
  z.object({ id: z.string() }),
  async (input, staff) => {
    await deleteCollection(db, input.id, staff.userId);
    expireTags(TAGS.collections, TAGS.collection(input.id), TAGS.home);
  },
);

export const reorderCollectionsAction = adminAction(
  "products.write",
  reorderSchema,
  async (input, staff) => {
    await reorder(db, "collection", input.ids, staff.userId);
    expireTags(TAGS.collections, TAGS.home);
  },
);

// Inventory (A8) -------------------------------------------------------------

export const adjustStockAction = adminAction(
  "inventory.adjust",
  stockAdjustSchema,
  async (input, staff) => {
    const result = await adjustStock(db, { ...input, actorId: staff.userId });
    expireTags(TAGS.products, TAGS.product(result.productId));
    return { stock: result.stock };
  },
);

export const listMovementsAction = adminAction(
  "inventory.read",
  z.object({ variantId: z.string() }),
  async (input) => {
    const rows = await listMovements(db, input.variantId);
    return rows.map((m) => ({
      id: m.id,
      delta: m.delta,
      reason: m.reason,
      note: m.note,
      createdAt: m.createdAt.toISOString(),
      actor: m.actor?.name ?? null,
      orderNumber: m.order?.number ?? null,
      orderId: m.order?.id ?? null,
    }));
  },
);
