"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { ProductCard as Card } from "@/server/queries/catalog";

import { ProductGrid } from "../product-card";

export function ProductTabs({
  products,
  categories,
  currency,
  limit,
}: {
  products: Card[];
  categories: { slug: string; name: string }[];
  currency: string;
  limit: number;
}) {
  const [active, setActive] = useState<string | null>(null);
  const shown = products.filter((p) => !active || p.categorySlug === active).slice(0, limit);
  const tabs = categories.filter((c) => products.some((p) => p.categorySlug === c.slug));
  return (
    <div className="flex flex-col gap-6">
      <div
        role="group"
        aria-label="Filter by category"
        className="flex flex-wrap justify-center gap-2"
      >
        <Button
          size="sm"
          variant={active === null ? "default" : "outline"}
          aria-pressed={active === null}
          onClick={() => setActive(null)}
        >
          All
        </Button>
        {tabs.map((c) => (
          <Button
            key={c.slug}
            size="sm"
            variant={active === c.slug ? "default" : "outline"}
            aria-pressed={active === c.slug}
            onClick={() => setActive(c.slug)}
          >
            {c.name}
          </Button>
        ))}
      </div>
      <ProductGrid products={shown} currency={currency} />
    </div>
  );
}
