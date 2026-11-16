import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import type { Prisma } from "@/generated/prisma/client";
import { TAGS } from "@/server/cache-tags";
import { db } from "@/server/db";

export type ProductCard = {
  id: string;
  slug: string;
  name: string;
  categoryId: string | null;
  categorySlug: string | null;
  image: { url: string; alt: string | null } | null;
  hoverImage: { url: string; alt: string | null } | null;
  price: number;
  compareAtPrice: number | null;
  onSale: boolean;
  inStock: boolean;
  ratingAverage: number;
  ratingCount: number;
  createdAt: string;
  salesRank: number;
};

const cardInclude = {
  category: { select: { slug: true } },
  images: {
    orderBy: [{ isCover: "desc" }, { position: "asc" }],
    take: 2,
    include: { media: { select: { url: true, alt: true } } },
  },
  variants: {
    where: { isActive: true },
    select: { price: true, compareAtPrice: true, stock: true },
  },
} satisfies Prisma.ProductInclude;

type CardRow = Prisma.ProductGetPayload<{ include: typeof cardInclude }>;

function toCard(p: CardRow, salesRank = 0): ProductCard | null {
  if (p.variants.length === 0) return null;
  const cheapest = [...p.variants].sort((a, b) => a.price - b.price)[0];
  const onSale = p.variants.some((v) => v.compareAtPrice !== null && v.compareAtPrice > v.price);
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    categoryId: p.categoryId,
    categorySlug: p.category?.slug ?? null,
    image: p.images[0]
      ? { url: p.images[0].media.url, alt: p.images[0].media.alt ?? p.name }
      : null,
    hoverImage: p.images[1]
      ? { url: p.images[1].media.url, alt: p.images[1].media.alt ?? p.name }
      : null,
    price: cheapest.price,
    compareAtPrice:
      cheapest.compareAtPrice && cheapest.compareAtPrice > cheapest.price
        ? cheapest.compareAtPrice
        : null,
    onSale,
    inStock: p.variants.some((v) => v.stock > 0),
    ratingAverage: p.ratingAverage,
    ratingCount: p.ratingCount,
    createdAt: p.createdAt.toISOString(),
    salesRank,
  };
}

/** Every published product with at least one active variant, as cards. Small catalogue: filtered in memory. */
export async function getPublishedProductCards(): Promise<ProductCard[]> {
  "use cache";
  cacheTag(TAGS.products);
  cacheLife("max");
  const [rows, sales] = await Promise.all([
    db.product.findMany({
      where: { status: "PUBLISHED" },
      include: cardInclude,
      orderBy: { createdAt: "desc" },
    }),
    db.orderItem.groupBy({
      by: ["productId"],
      where: {
        order: {
          status: { in: ["PAID", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"] },
        },
        productId: { not: null },
      },
      _sum: { quantity: true },
    }),
  ]);
  const sold = new Map(sales.map((s) => [s.productId, s._sum.quantity ?? 0]));
  return rows
    .map((r) => toCard(r, sold.get(r.id) ?? 0))
    .filter((c): c is ProductCard => c !== null);
}

export async function getCategories() {
  "use cache";
  cacheTag(TAGS.categories);
  cacheLife("max");
  return db.category.findMany({
    orderBy: { position: "asc" },
    select: { id: true, name: true, slug: true, description: true },
  });
}

export async function getCollections() {
  "use cache";
  cacheTag(TAGS.collections);
  cacheLife("max");
  const rows = await db.collection.findMany({
    orderBy: { position: "asc" },
    include: {
      bannerImage: { select: { url: true, alt: true } },
      _count: { select: { products: { where: { product: { status: "PUBLISHED" } } } } },
    },
  });
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    banner: c.bannerImage ? { url: c.bannerImage.url, alt: c.bannerImage.alt ?? c.name } : null,
    productCount: c._count.products,
  }));
}

export async function getCollectionBySlug(slug: string) {
  "use cache";
  cacheTag(TAGS.collections);
  cacheLife("max");
  const c = await db.collection.findUnique({
    where: { slug },
    include: {
      bannerImage: { select: { url: true, alt: true } },
      products: { orderBy: { position: "asc" }, select: { productId: true } },
    },
  });
  if (!c) return null;
  cacheTag(TAGS.collection(c.id));
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    banner: c.bannerImage ? { url: c.bannerImage.url, alt: c.bannerImage.alt ?? c.name } : null,
    productIds: c.products.map((p) => p.productId),
  };
}

const detailInclude = {
  category: { select: { name: true, slug: true } },
  images: {
    orderBy: [{ isCover: "desc" }, { position: "asc" }],
    include: { media: { select: { id: true, url: true, alt: true, width: true, height: true } } },
  },
  options: { orderBy: { position: "asc" } },
  variants: { where: { isActive: true }, orderBy: { createdAt: "asc" } },
  collections: { select: { collection: { select: { id: true } } } },
} satisfies Prisma.ProductInclude;

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof loadProductDetail>>>;

async function loadProductDetail(where: Prisma.ProductWhereUniqueInput) {
  const p = await db.product.findUnique({ where, include: detailInclude });
  if (!p) return null;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    status: p.status,
    description: p.description,
    specs: p.specs,
    sizeGuide: p.sizeGuide,
    metaTitle: p.metaTitle,
    metaDescription: p.metaDescription,
    ratingAverage: p.ratingAverage,
    ratingCount: p.ratingCount,
    category: p.category,
    images: p.images.map((i) => ({
      id: i.media.id,
      url: i.media.url,
      alt: i.media.alt ?? p.name,
      width: i.media.width,
      height: i.media.height,
    })),
    options: p.options.map((o) => ({ name: o.name, values: o.values })),
    variants: p.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      optionValues: v.optionValues as Record<string, string>,
      price: v.price,
      compareAtPrice: v.compareAtPrice && v.compareAtPrice > v.price ? v.compareAtPrice : null,
      stock: v.stock,
      lowStockThreshold: v.lowStockThreshold,
      imageId: v.imageId,
    })),
    collectionIds: p.collections.map((c) => c.collection.id),
  };
}

/** Published product for the storefront, or null. */
export async function getProductBySlug(slug: string) {
  "use cache";
  cacheTag(TAGS.products);
  cacheLife("max");
  const p = await loadProductDetail({ slug });
  if (!p || p.status !== "PUBLISHED" || p.variants.length === 0) return null;
  cacheTag(TAGS.product(p.id));
  return p;
}

/** Any status, uncached. Only for staff preview. */
export function getProductForPreview(slug: string) {
  return loadProductDetail({ slug });
}
