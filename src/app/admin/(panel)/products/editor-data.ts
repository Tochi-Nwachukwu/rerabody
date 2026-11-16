import "server-only";

import type { EditorState } from "@/components/admin/catalogue/product-editor";
import type { RichTextValue } from "@/components/admin/rich-text-editor";
import { db } from "@/server/db";
import { getProductForEdit } from "@/server/services/products";

export async function loadTaxonomy() {
  const [categories, collections] = await Promise.all([
    db.category.findMany({ orderBy: { position: "asc" }, select: { id: true, name: true } }),
    db.collection.findMany({ orderBy: { position: "asc" }, select: { id: true, name: true } }),
  ]);
  return { categories, collections };
}

export const emptyProduct: EditorState = {
  name: "",
  slug: "",
  status: "DRAFT",
  categoryId: null,
  collectionIds: [],
  description: null,
  specs: null,
  sizeGuide: null,
  metaTitle: "",
  metaDescription: "",
  images: [],
  options: [],
  variants: [
    {
      optionValues: {},
      sku: "",
      price: 0,
      compareAtPrice: null,
      initialStock: 0,
      lowStockThreshold: 5,
      imageId: null,
      isActive: true,
    },
  ],
};

export async function loadProductEditorState(id: string): Promise<EditorState | null> {
  const p = await getProductForEdit(db, id);
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    status: p.status,
    categoryId: p.categoryId,
    collectionIds: p.collections.map((c) => c.collectionId),
    description: p.description as RichTextValue,
    specs: p.specs as RichTextValue,
    sizeGuide: p.sizeGuide as RichTextValue,
    metaTitle: p.metaTitle ?? "",
    metaDescription: p.metaDescription ?? "",
    images: p.images.map((i) => ({
      mediaId: i.mediaId,
      url: i.media.url,
      alt: i.media.alt,
      isCover: i.isCover,
    })),
    options: p.options.map((o) => ({ name: o.name, values: o.values })),
    variants: p.variants
      .filter((v) => !v.sku.includes("-RETIRED-"))
      .map((v) => ({
        id: v.id,
        optionValues: v.optionValues as Record<string, string>,
        sku: v.sku,
        price: v.price,
        compareAtPrice: v.compareAtPrice,
        initialStock: 0,
        stock: v.stock,
        lowStockThreshold: v.lowStockThreshold,
        imageId: v.imageId,
        isActive: v.isActive,
      })),
  };
}
