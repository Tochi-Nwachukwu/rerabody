import type { Metadata } from "next";
import { Suspense } from "react";

import { PageTitle } from "@/components/store/page-title";
import { GridSkeleton } from "@/components/store/grid-skeleton";
import { ProductGrid } from "@/components/store/product-card";
import { ShopControls } from "@/components/store/shop-controls";
import { ShopPager } from "@/components/store/shop-pager";
import { env } from "@/env";
import { minorUnitDigits } from "@/lib/money";
import { applyShop, parseShopParams } from "@/lib/shop-filter";
import { getCategories, getPublishedProductCards } from "@/server/queries/catalog";

export const metadata: Metadata = {
  title: "Shop all",
  description: "Shop every body butter and nightwear piece.",
  alternates: { canonical: "/shop" },
};

// S2 shop
export default function ShopPage({ searchParams }: PageProps<"/shop">) {
  return (
    <>
      <PageTitle title="Shop all" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Suspense fallback={<GridSkeleton />}>
          <ShopResults searchParams={searchParams} />
        </Suspense>
      </div>
    </>
  );
}

async function ShopResults({ searchParams }: { searchParams: PageProps<"/shop">["searchParams"] }) {
  const sp = await searchParams;
  const params = parseShopParams(sp, minorUnitDigits(env.STORE_CURRENCY));
  const [cards, categories] = await Promise.all([getPublishedProductCards(), getCategories()]);
  const { items, total, page, pageCount } = applyShop(cards, params);
  const hrefFor = (p: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(sp))
      if (typeof v === "string" && k !== "page") qs.set(k, v);
    qs.set("page", String(p));
    return `/shop?${qs}`;
  };
  return (
    <div className="flex flex-col gap-6">
      <ShopControls categories={categories} total={total} />
      {items.length ? (
        <ProductGrid
          headingLevel="h2"
          products={items}
          currency={env.STORE_CURRENCY}
          priorityCount={4}
        />
      ) : (
        <p className="text-muted-foreground rounded-xl border border-dashed px-4 py-12 text-center">
          No products match these filters.
        </p>
      )}
      <ShopPager page={page} pageCount={pageCount} hrefFor={hrefFor} />
    </div>
  );
}
