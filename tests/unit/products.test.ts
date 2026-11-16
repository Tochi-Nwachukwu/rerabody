import { beforeEach, describe, expect, it } from "vitest";

import { productSchema } from "@/lib/schemas/catalogue";
import { reconcileVariants } from "@/lib/variants";
import { saveProduct } from "@/server/services/products";

import { resetDb, testDb } from "../helpers/db";
import { createMedia, createRole, createUser } from "../helpers/factories";

describe("saveProduct", () => {
  let actorId: string;
  beforeEach(async () => {
    await resetDb();
    actorId = (await createUser({ roleId: (await createRole("Manager")).id })).id;
  });

  function input(overrides: Record<string, unknown> = {}) {
    const options = [
      { name: "Size", values: ["S", "M"] },
      { name: "Colour", values: ["Ivory", "Black"] },
    ];
    return productSchema.parse({
      name: "Satin slip",
      slug: "satin-slip",
      status: "PUBLISHED",
      categoryId: null,
      collectionIds: [],
      description: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Soft satin" }] }],
      },
      specs: null,
      sizeGuide: null,
      metaTitle: "",
      metaDescription: "",
      images: [],
      options,
      variants: reconcileVariants(options, [], { skuBase: "slip", price: 4500 }).map((v) => ({
        ...v,
        initialStock: 4,
      })),
      ...overrides,
    });
  }

  it("creates a product with two options, four variants, opening stock and images", async () => {
    const [a, b, c] = await Promise.all([createMedia(), createMedia(), createMedia()]);
    const res = await saveProduct(
      testDb,
      input({
        images: [
          { mediaId: a.id, isCover: false },
          { mediaId: b.id, isCover: true },
          { mediaId: c.id, isCover: false },
        ],
      }),
      actorId,
    );
    const product = await testDb.product.findUniqueOrThrow({
      where: { id: res.id },
      include: { variants: true, options: true, images: { orderBy: { position: "asc" } } },
    });
    expect(product.options).toHaveLength(2);
    expect(product.variants).toHaveLength(4);
    expect(product.variants.every((v) => v.stock === 4)).toBe(true);
    expect(await testDb.inventoryMovement.count({ where: { reason: "RESTOCK" } })).toBe(4);
    expect(product.images.map((i) => i.isCover)).toEqual([false, true, false]);
    // The search vector trigger fills from name and description.
    const hits = await testDb.$queryRaw<
      { id: string }[]
    >`SELECT id FROM "Product" WHERE "searchVector" @@ websearch_to_tsquery('english', 'satin')`;
    expect(hits.map((h) => h.id)).toContain(res.id);
  });

  it("does not change stock of existing variants on edit", async () => {
    const res = await saveProduct(testDb, input(), actorId);
    const saved = await testDb.productVariant.findMany({ where: { productId: res.id } });
    const edit = input({
      id: res.id,
      variants: saved.map((v) => ({
        id: v.id,
        optionValues: v.optionValues,
        sku: v.sku,
        price: 5000,
        compareAtPrice: null,
        initialStock: 99,
        lowStockThreshold: 2,
        imageId: null,
        isActive: true,
      })),
    });
    await saveProduct(testDb, edit, actorId);
    const after = await testDb.productVariant.findMany({ where: { productId: res.id } });
    expect(after.every((v) => v.stock === 4 && v.price === 5000)).toBe(true);
  });

  it("refuses a duplicate SKU with a readable message", async () => {
    await saveProduct(testDb, input(), actorId);
    await expect(saveProduct(testDb, input({ slug: "another-slip" }), actorId)).rejects.toThrow(
      "A SKU is already used by another product.",
    );
  });

  it("refuses a duplicate slug with a readable message", async () => {
    await saveProduct(testDb, input(), actorId);
    await expect(
      saveProduct(
        testDb,
        input({ variants: input().variants.map((v) => ({ ...v, sku: `${v.sku}-2` })) }),
        actorId,
      ),
    ).rejects.toThrow("That URL slug is already used.");
  });
});
