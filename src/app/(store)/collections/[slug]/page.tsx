import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { GridSkeleton } from "@/components/store/grid-skeleton";
import { PageTitle } from "@/components/store/page-title";
import { ProductGrid } from "@/components/store/product-card";
import { ShopControls } from "@/components/store/shop-controls";
import { ShopPager } from "@/components/store/shop-pager";
import { env } from "@/env";
import { minorUnitDigits } from "@/lib/money";
import { applyShop, parseShopParams } from "@/lib/shop-filter";
import { getCollectionBySlug, getPublishedProductCards } from "@/server/queries/catalog";

export async function generateMetadata({
  params,
}: PageProps<"/collections/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const c = await getCollectionBySlug(slug);
  if (!c) return { title: "Collection not found" };
  return {
    title: c.name,
    description: c.description ?? `Shop the ${c.name} collection.`,
    alternates: { canonical: `/collections/${c.slug}` },
    openGraph: {
      title: c.name,
      description: c.description ?? undefined,
      images: c.banner ? [{ url: c.banner.url }] : undefined,
    },
  };
}

// S4 collection
export default function CollectionPage({ params, searchParams }: PageProps<"/collections/[slug]">) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 pt-24 sm:px-6">
          <GridSkeleton />
        </div>
      }
    >
      <Collection params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Collection({ params, searchParams }: PageProps<"/collections/[slug]">) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const collection = await getCollectionBySlug(slug);
  if (!collection) notFound();
  const cards = await getPublishedProductCards();
  const order = new Map(collection.productIds.map((id, i) => [id, i]));
  const inCollection = cards
    .filter((c) => order.has(c.id))
    .sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  const p = parseShopParams(sp, minorUnitDigits(env.STORE_CURRENCY));
  // Featured keeps the order set in the admin.
  const items =
    p.sort === "featured" ? applyShopFeatured(inCollection, p) : applyShop(inCollection, p);
  const hrefFor = (n: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(sp))
      if (typeof v === "string" && k !== "page") qs.set(k, v);
    qs.set("page", String(n));
    return `/collections/${slug}?${qs}`;
  };
  return (
    <>
      {collection.banner ? (
        <div className="bg-secondary relative h-48 w-full overflow-hidden sm:h-72">
          <Image
            src={collection.banner.url}
            alt={collection.banner.alt ?? ""}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        </div>
      ) : null}
      <PageTitle title={collection.name}>
        {collection.description ? <p>{collection.description}</p> : null}
      </PageTitle>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:px-6">
        <ShopControls categories={[]} total={items.total} showCategories={false} />
        {items.items.length ? (
          <ProductGrid
            headingLevel="h2"
            products={items.items}
            currency={env.STORE_CURRENCY}
            priorityCount={collection.banner ? 0 : 4}
          />
        ) : (
          <p className="text-muted-foreground rounded-xl border border-dashed px-4 py-12 text-center">
            No products match.
          </p>
        )}
        <ShopPager page={items.page} pageCount={items.pageCount} hrefFor={hrefFor} />
      </div>
    </>
  );
}

/** Applies filters but keeps the collection's own order. */
function applyShopFeatured<T extends Parameters<typeof applyShop>[0][number]>(
  cards: T[],
  p: ReturnType<typeof parseShopParams>,
) {
  const filtered = applyShop(cards, { ...p, page: 1 }, { pageSize: 10_000 }).items;
  const keep = new Set(filtered);
  const ordered = cards.filter((c) => keep.has(c));
  const pageSize = 24;
  const pageCount = Math.max(1, Math.ceil(ordered.length / pageSize));
  const page = Math.min(p.page, pageCount);
  return {
    items: ordered.slice((page - 1) * pageSize, page * pageSize),
    total: ordered.length,
    page,
    pageCount,
  };
}
