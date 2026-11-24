import { describe, expect, it } from "vitest";

import { applyShop, parseShopParams } from "@/lib/shop-filter";

const card = (o: Partial<Parameters<typeof applyShop>[0][number]> & { name: string }) => ({
  categorySlug: "body-butters",
  price: 1000,
  inStock: true,
  onSale: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  ratingAverage: 0,
  ratingCount: 0,
  salesRank: 0,
  ...o,
});

describe("shop filters", () => {
  const cards = [
    card({ name: "A", price: 1800, createdAt: "2026-03-01T00:00:00Z", salesRank: 5 }),
    card({
      name: "B",
      price: 4500,
      categorySlug: "loungewear",
      onSale: true,
      ratingAverage: 4.5,
      ratingCount: 2,
    }),
    card({ name: "C", price: 2900, inStock: false, createdAt: "2026-05-01T00:00:00Z" }),
  ];

  it("parses URL state with defaults and converts prices to minor units", () => {
    expect(parseShopParams({})).toMatchObject({ sort: "featured", page: 1, inStock: false });
    expect(
      parseShopParams({ sort: "bogus", min: "10", max: "30.5", stock: "1", page: "-2" }),
    ).toMatchObject({ sort: "featured", min: 1000, max: 3050, inStock: true, page: 1 });
  });

  it("filters by category, price, stock and sale", () => {
    const names = (p: Record<string, string>) =>
      applyShop(cards, parseShopParams(p)).items.map((c) => c.name);
    expect(names({ category: "loungewear" })).toEqual(["B"]);
    expect(names({ min: "20", max: "30", sort: "price-asc" })).toEqual(["C"]);
    expect(names({ stock: "1", sort: "price-asc" })).toEqual(["A", "B"]);
    expect(names({ sale: "1" })).toEqual(["B"]);
  });

  it("sorts by price, newest and rating", () => {
    const names = (sort: string) =>
      applyShop(cards, parseShopParams({ sort })).items.map((c) => c.name);
    expect(names("price-asc")).toEqual(["A", "C", "B"]);
    expect(names("price-desc")).toEqual(["B", "C", "A"]);
    expect(names("newest")).toEqual(["C", "A", "B"]);
    expect(names("rating")[0]).toBe("B");
    expect(names("featured").at(-1)).toBe("C");
  });

  it("paginates and clamps the page", () => {
    const res = applyShop(cards, parseShopParams({ page: "9" }), { pageSize: 2 });
    expect(res).toMatchObject({ total: 3, pageCount: 2, page: 2 });
    expect(res.items).toHaveLength(1);
  });
});
