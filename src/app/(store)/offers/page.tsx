import type { Metadata } from "next";
import { Suspense } from "react";

import { GridSkeleton } from "@/components/store/grid-skeleton";
import { PageTitle } from "@/components/store/page-title";
import { ProductGrid } from "@/components/store/product-card";
import { env } from "@/env";
import { formatMoney } from "@/lib/money";
import { getPublishedProductCards } from "@/server/queries/catalog";
import { getPublicCoupons } from "@/server/queries/offers";

export const metadata: Metadata = {
  title: "Offers",
  description: "Products on sale and current promo codes.",
  alternates: { canonical: "/offers" },
};

// S7 offers
export default function OffersPage() {
  return (
    <>
      <PageTitle title="Offers">
        <p>Products on sale and current promo codes.</p>
      </PageTitle>
      <div className="mx-auto flex max-w-7xl flex-col gap-12 px-4 sm:px-6">
        <Suspense fallback={null}>
          <Coupons />
        </Suspense>
        <Suspense fallback={<GridSkeleton />}>
          <SaleProducts />
        </Suspense>
      </div>
    </>
  );
}

async function Coupons() {
  const coupons = await getPublicCoupons();
  if (!coupons.length) return null;
  const currency = env.STORE_CURRENCY;
  return (
    <section aria-labelledby="codes">
      <h2 id="codes" className="font-heading mb-4 text-3xl">
        Promo codes
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {coupons.map((c) => (
          <li key={c.code} className="bg-secondary/40 rounded-xl border border-dashed p-4">
            <p className="font-mono text-lg font-semibold tracking-wider">{c.code}</p>
            <p className="text-sm">
              {c.type === "PERCENT" ? `${c.value}% off` : `${formatMoney(c.value, currency)} off`}
              {c.minSpend ? ` when you spend ${formatMoney(c.minSpend, currency)} or more` : ""}
            </p>
            {c.endsAt ? (
              <p className="text-muted-foreground mt-1 text-xs">
                Ends{" "}
                {new Date(c.endsAt).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

async function SaleProducts() {
  const cards = (await getPublishedProductCards()).filter((c) => c.onSale);
  return (
    <section aria-labelledby="sale">
      <h2 id="sale" className="font-heading mb-6 text-3xl">
        On sale
      </h2>
      {cards.length ? (
        <ProductGrid products={cards} currency={env.STORE_CURRENCY} />
      ) : (
        <p className="text-muted-foreground rounded-xl border border-dashed px-4 py-12 text-center">
          Nothing is on sale right now. Check back soon.
        </p>
      )}
    </section>
  );
}
