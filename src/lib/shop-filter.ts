/** Shop filtering, sorting and pagination over product cards. URL state in, results out. */

export const SORTS = {
  featured: "Featured",
  bestselling: "Best selling",
  newest: "Newest",
  "price-asc": "Price, low to high",
  "price-desc": "Price, high to low",
  rating: "Top rated",
} as const;
export type SortKey = keyof typeof SORTS;

export type ShopParams = {
  category?: string;
  sort: SortKey;
  min?: number; // minor units
  max?: number;
  inStock: boolean;
  onSale: boolean;
  page: number;
};

type Card = {
  categorySlug: string | null;
  price: number;
  inStock: boolean;
  onSale: boolean;
  createdAt: string;
  ratingAverage: number;
  ratingCount: number;
  salesRank: number;
  name: string;
};

export const SHOP_PAGE_SIZE = 24;

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export function parseShopParams(
  sp: Record<string, string | string[] | undefined>,
  minorDigits = 2,
): ShopParams {
  const sort = one(sp.sort);
  const money = (v: string | undefined) => {
    if (!v) return undefined;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 10 ** minorDigits) : undefined;
  };
  const page = Number(one(sp.page));
  return {
    category: one(sp.category) || undefined,
    sort: sort && sort in SORTS ? (sort as SortKey) : "featured",
    min: money(one(sp.min)),
    max: money(one(sp.max)),
    inStock: one(sp.stock) === "1",
    onSale: one(sp.sale) === "1",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

export function applyShop<T extends Card>(
  cards: T[],
  p: ShopParams,
  opts: { pageSize?: number; featuredOrder?: string[] } = {},
) {
  const pageSize = opts.pageSize ?? SHOP_PAGE_SIZE;
  let list = cards.filter(
    (c) =>
      (!p.category || c.categorySlug === p.category) &&
      (p.min === undefined || c.price >= p.min) &&
      (p.max === undefined || c.price <= p.max) &&
      (!p.inStock || c.inStock) &&
      (!p.onSale || c.onSale),
  );
  const byName = (a: T, b: T) => a.name.localeCompare(b.name);
  switch (p.sort) {
    case "newest":
      list = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      break;
    case "price-asc":
      list = [...list].sort((a, b) => a.price - b.price || byName(a, b));
      break;
    case "price-desc":
      list = [...list].sort((a, b) => b.price - a.price || byName(a, b));
      break;
    case "rating":
      list = [...list].sort(
        (a, b) =>
          b.ratingAverage - a.ratingAverage || b.ratingCount - a.ratingCount || byName(a, b),
      );
      break;
    case "bestselling":
      list = [...list].sort((a, b) => b.salesRank - a.salesRank || byName(a, b));
      break;
    default:
      // Featured: in-stock first, then the given order (e.g. collection position), then best selling.
      list = [...list].sort(
        (a, b) => Number(b.inStock) - Number(a.inStock) || b.salesRank - a.salesRank,
      );
  }
  const total = list.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(p.page, pageCount);
  return { items: list.slice((page - 1) * pageSize, page * pageSize), total, page, pageCount };
}

export function shopQuery(
  p: Partial<ShopParams> & { minText?: string; maxText?: string },
  overrides: Record<string, string | undefined> = {},
) {
  const qs = new URLSearchParams();
  const set = (k: string, v: string | undefined) => v && qs.set(k, v);
  set("category", p.category);
  if (p.sort && p.sort !== "featured") set("sort", p.sort);
  set("min", p.minText);
  set("max", p.maxText);
  if (p.inStock) set("stock", "1");
  if (p.onSale) set("sale", "1");
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) qs.delete(k);
    else qs.set(k, v);
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}
