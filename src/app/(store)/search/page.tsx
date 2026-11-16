import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { GridSkeleton } from "@/components/store/grid-skeleton";
import { PageTitle } from "@/components/store/page-title";
import { ProductGrid } from "@/components/store/product-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { env } from "@/env";
import { db } from "@/server/db";
import { getPublishedProductCards } from "@/server/queries/catalog";
import { searchProductIds } from "@/server/services/search";

export const metadata: Metadata = { title: "Search", robots: { index: false, follow: true } };

// S6 search results
export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <>
      <PageTitle title="Search" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Suspense fallback={<GridSkeleton />}>
          <Results searchParams={searchParams} />
        </Suspense>
      </div>
    </>
  );
}

async function Results({ searchParams }: { searchParams: PageProps<"/search">["searchParams"] }) {
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 100);
  const [ids, cards] = await Promise.all([
    q ? searchProductIds(db, q) : Promise.resolve([]),
    getPublishedProductCards(),
  ]);
  const byId = new Map(cards.map((c) => [c.id, c]));
  const results = ids.map((id) => byId.get(id)).filter((c) => c !== undefined);
  return (
    <div className="flex flex-col gap-8">
      <form role="search" action="/search" className="mx-auto flex w-full max-w-lg gap-2">
        <Input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search products"
          aria-label="Search products"
        />
        <Button type="submit">Search</Button>
      </form>
      {q ? (
        <p className="text-muted-foreground text-center text-sm" aria-live="polite">
          {results.length} result{results.length === 1 ? "" : "s"} for “{q}”
        </p>
      ) : null}
      {results.length ? (
        <ProductGrid headingLevel="h2" products={results} currency={env.STORE_CURRENCY} />
      ) : q ? (
        <div className="rounded-xl border border-dashed px-4 py-12 text-center">
          <p className="font-medium">No products found</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Check the spelling or{" "}
            <Link href="/shop" className="underline underline-offset-4">
              browse the shop
            </Link>
            .
          </p>
        </div>
      ) : null}
    </div>
  );
}
