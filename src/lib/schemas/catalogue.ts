import { z } from "zod";

import { SLUG_PATTERN } from "@/lib/slug";
import { TAX_CODE_IDS } from "@/lib/tax-codes";
import { checkVariantsMatchOptions } from "@/lib/variants";

/** Tiptap document JSON. Structure is checked loosely; rendering ignores unknown nodes. */
export const richTextSchema = z
  .object({
    type: z.literal("doc"),
    content: z.array(z.record(z.string(), z.unknown())).optional(),
  })
  .passthrough()
  .nullable();
export type RichText = z.infer<typeof richTextSchema>;

export const slugSchema = z
  .string()
  .trim()
  .min(1, "Enter a URL slug")
  .max(80)
  .regex(SLUG_PATTERN, "Use lowercase letters, numbers and hyphens");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable();

const money = z.number().int("Use whole minor units").min(0, "Must be 0 or more").max(100_000_000);

export const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Enter a name").max(80),
  slug: slugSchema,
  description: optionalText(500),
  imageId: z.string().nullable(),
  // Stripe product tax code; null uses the store default (see src/lib/tax-codes.ts).
  taxCode: z.enum(TAX_CODE_IDS).nullable().default(null),
});
export type CategoryInput = z.input<typeof categorySchema>;

export const collectionSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Enter a name").max(80),
  slug: slugSchema,
  description: optionalText(1000),
  bannerImageId: z.string().nullable(),
  productIds: z.array(z.string()).max(500),
});
export type CollectionInput = z.input<typeof collectionSchema>;

export const reorderSchema = z.object({ ids: z.array(z.string()).min(1).max(500) });

const optionSchema = z.object({
  name: z.string().trim().min(1, "Name the option").max(30),
  values: z.array(z.string().trim().min(1).max(40)).min(1, "Add at least one value").max(30),
});

const variantSchema = z
  .object({
    id: z.string().optional(),
    optionValues: z.record(z.string(), z.string()),
    sku: z
      .string()
      .trim()
      .min(1, "Enter a SKU")
      .max(64)
      .regex(/^[A-Za-z0-9._-]+$/, "Use letters, numbers, dots, dashes or underscores"),
    price: money,
    compareAtPrice: money.nullable(),
    initialStock: z.number().int().min(0).max(1_000_000),
    lowStockThreshold: z.number().int().min(0).max(100_000),
    imageId: z.string().nullable(),
    isActive: z.boolean(),
  })
  .refine((v) => v.compareAtPrice === null || v.compareAtPrice > v.price, {
    path: ["compareAtPrice"],
    message: "Compare-at price must be higher than the price",
  });

export const productSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(1, "Enter a product name").max(120),
    slug: slugSchema,
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
    categoryId: z.string().nullable(),
    collectionIds: z.array(z.string()).max(50),
    description: richTextSchema,
    specs: richTextSchema,
    sizeGuide: richTextSchema,
    metaTitle: optionalText(70),
    metaDescription: optionalText(170),
    images: z
      .array(z.object({ mediaId: z.string(), isCover: z.boolean() }))
      .max(30)
      .refine(
        (imgs) => new Set(imgs.map((i) => i.mediaId)).size === imgs.length,
        "Each image can be added once",
      ),
    options: z.array(optionSchema).max(3, "Use at most three options"),
    variants: z.array(variantSchema).min(1, "Add at least one variant").max(200),
  })
  .superRefine((p, ctx) => {
    const problem = checkVariantsMatchOptions(p.options, p.variants);
    if (problem) ctx.addIssue({ code: "custom", path: ["variants"], message: problem });
    const skus = p.variants.map((v) => v.sku.toUpperCase());
    if (new Set(skus).size !== skus.length)
      ctx.addIssue({
        code: "custom",
        path: ["variants"],
        message: "Each variant needs a different SKU",
      });
    if (p.status === "PUBLISHED" && !p.variants.some((v) => v.isActive)) {
      ctx.addIssue({
        code: "custom",
        path: ["status"],
        message: "A published product needs at least one active variant",
      });
    }
  });
export type ProductInput = z.input<typeof productSchema>;
export type ProductData = z.output<typeof productSchema>;

export const stockAdjustSchema = z.object({
  variantId: z.string(),
  mode: z.enum(["delta", "set"]),
  amount: z.number().int().min(-1_000_000).max(1_000_000),
  reason: z.enum(["RESTOCK", "DAMAGE", "CORRECTION"]),
  note: optionalText(300),
});
export type StockAdjustInput = z.input<typeof stockAdjustSchema>;
