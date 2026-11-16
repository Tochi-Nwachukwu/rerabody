import { describe, expect, it } from "vitest";

import { productSchema } from "@/lib/schemas/catalogue";
import {
  checkVariantsMatchOptions,
  combinations,
  reconcileVariants,
  suggestSku,
  variantLabel,
} from "@/lib/variants";

describe("variant generation", () => {
  it("returns one empty combination when there are no options", () => {
    expect(combinations([])).toEqual([{}]);
  });

  it("builds every combination of two options in order", () => {
    const combos = combinations([
      { name: "Size", values: ["S", "M"] },
      { name: "Colour", values: ["Ivory", "Black", "Sage"] },
    ]);
    expect(combos).toHaveLength(6);
    expect(combos[0]).toEqual({ Size: "S", Colour: "Ivory" });
    expect(combos[5]).toEqual({ Size: "M", Colour: "Sage" });
  });

  it("keeps existing variants when a value is added and drops removed combinations", () => {
    const options = [{ name: "Size", values: ["S", "M"] }];
    const first = reconcileVariants(options, [], { skuBase: "slip", price: 4500 });
    expect(first.map((v) => v.sku)).toEqual(["SLIP-S", "SLIP-M"]);
    const edited = first.map((v, i) => ({ ...v, id: `v${i}`, price: 5000 + i }));

    const next = reconcileVariants([{ name: "Size", values: ["M", "L"] }], edited, {
      skuBase: "slip",
      price: 4500,
    });
    expect(next).toHaveLength(2);
    expect(next[0]).toMatchObject({ id: "v1", price: 5001, optionValues: { Size: "M" } });
    expect(next[1]).toMatchObject({ sku: "SLIP-L", price: 4500 });
    expect(next[1].id).toBeUndefined();
  });

  it("adding a second option creates new variants for each combination", () => {
    const sizes = reconcileVariants([{ name: "Size", values: ["S", "M"] }], [], {
      skuBase: "set",
      price: 100,
    });
    const both = reconcileVariants(
      [
        { name: "Size", values: ["S", "M"] },
        { name: "Colour", values: ["Blush"] },
      ],
      sizes,
      { skuBase: "set", price: 100 },
    );
    expect(both.map((v) => variantLabel(v.optionValues))).toEqual(["S / Blush", "M / Blush"]);
    expect(
      checkVariantsMatchOptions(
        [
          { name: "Size", values: ["S", "M"] },
          { name: "Colour", values: ["Blush"] },
        ],
        both,
      ),
    ).toBeNull();
  });

  it("keeps the default variant when the product has no options", () => {
    const existing = reconcileVariants([], [], { skuBase: "butter", price: 1800 });
    expect(existing).toHaveLength(1);
    expect(existing[0].optionValues).toEqual({});
  });

  it("rejects variants that do not match the options", () => {
    const options = [{ name: "Size", values: ["S", "M"] }];
    expect(checkVariantsMatchOptions(options, [{ optionValues: { Size: "S" } }])).toMatch(
      /Every combination/,
    );
    expect(
      checkVariantsMatchOptions(options, [
        { optionValues: { Size: "S" } },
        { optionValues: { Size: "XL" } },
      ]),
    ).toMatch(/does not exist/);
    expect(checkVariantsMatchOptions([{ name: "Size", values: ["S", "s"] }], [])).toMatch(
      /must be different/,
    );
  });

  it("suggests readable SKUs", () => {
    expect(suggestSku("Satin slip", { Size: "M", Colour: "Ivory" })).toBe("SATINSLIP-M-IVORY");
  });

  it("product schema enforces options, unique SKUs and compare-at prices", () => {
    const base = {
      name: "Slip",
      slug: "slip",
      status: "DRAFT" as const,
      categoryId: null,
      collectionIds: [],
      description: null,
      specs: null,
      sizeGuide: null,
      metaTitle: null,
      metaDescription: null,
      images: [],
      options: [{ name: "Size", values: ["S", "M"] }],
      variants: [
        {
          optionValues: { Size: "S" },
          sku: "A",
          price: 100,
          compareAtPrice: null,
          initialStock: 0,
          lowStockThreshold: 1,
          imageId: null,
          isActive: true,
        },
        {
          optionValues: { Size: "M" },
          sku: "A",
          price: 100,
          compareAtPrice: 50,
          initialStock: 0,
          lowStockThreshold: 1,
          imageId: null,
          isActive: true,
        },
      ],
    };
    const res = productSchema.safeParse(base);
    expect(res.success).toBe(false);
    const messages = res.error!.issues.map((i) => i.message);
    expect(messages).toContain("Each variant needs a different SKU");
    expect(messages).toContain("Compare-at price must be higher than the price");
  });
});
