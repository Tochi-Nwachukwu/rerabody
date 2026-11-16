"use client";

import { SlidersHorizontal } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SORTS } from "@/lib/shop-filter";

/** Sort and filter controls. All state lives in the URL. */
export function ShopControls({
  categories,
  total,
  showCategories = true,
}: {
  categories: { slug: string; name: string }[];
  total: number;
  showCategories?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [min, setMin] = useState(params.get("min") ?? "");
  const [max, setMax] = useState(params.get("max") ?? "");
  const [inStock, setInStock] = useState(params.get("stock") === "1");
  const [onSale, setOnSale] = useState(params.get("sale") === "1");

  function push(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    next.delete("page");
    const qs = next.toString();
    start(() => router.push(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false }));
  }

  const activeCategory = params.get("category");
  const filterCount = [
    params.get("min"),
    params.get("max"),
    params.get("stock"),
    params.get("sale"),
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-4" aria-busy={pending}>
      {showCategories ? (
        <nav aria-label="Categories" className="-mx-4 overflow-x-auto px-4">
          <ul className="flex gap-2">
            <li>
              <Button
                size="sm"
                variant={!activeCategory ? "default" : "outline"}
                aria-current={!activeCategory ? "page" : undefined}
                onClick={() => push({ category: null })}
              >
                All
              </Button>
            </li>
            {categories.map((c) => (
              <li key={c.slug}>
                <Button
                  size="sm"
                  variant={activeCategory === c.slug ? "default" : "outline"}
                  aria-current={activeCategory === c.slug ? "page" : undefined}
                  onClick={() => push({ category: c.slug })}
                >
                  {c.name}
                </Button>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button variant="outline" size="sm" />}>
            <SlidersHorizontal /> Filter{filterCount ? ` (${filterCount})` : ""}
          </SheetTrigger>
          <SheetContent side="left" className="w-80">
            <SheetHeader>
              <SheetTitle>Filter</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-5 px-4">
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium">Price</legend>
                <div className="flex items-center gap-2">
                  <Input
                    inputMode="decimal"
                    aria-label="Minimum price"
                    placeholder="Min"
                    value={min}
                    onChange={(e) => setMin(e.target.value)}
                  />
                  <span aria-hidden>to</span>
                  <Input
                    inputMode="decimal"
                    aria-label="Maximum price"
                    placeholder="Max"
                    value={max}
                    onChange={(e) => setMax(e.target.value)}
                  />
                </div>
              </fieldset>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={inStock} onCheckedChange={(c) => setInStock(!!c)} /> In stock
                only
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={onSale} onCheckedChange={(c) => setOnSale(!!c)} /> On sale
              </label>
            </div>
            <SheetFooter className="flex-row gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setMin("");
                  setMax("");
                  setInStock(false);
                  setOnSale(false);
                  push({ min: null, max: null, stock: null, sale: null });
                  setOpen(false);
                }}
              >
                Clear
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  push({
                    min: min.trim() || null,
                    max: max.trim() || null,
                    stock: inStock ? "1" : null,
                    sale: onSale ? "1" : null,
                  });
                  setOpen(false);
                }}
              >
                Show results
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
        <p className="text-muted-foreground text-sm" aria-live="polite">
          {total} product{total === 1 ? "" : "s"}
        </p>
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only sm:not-sr-only">Sort by</span>
          <select
            className="bg-background h-8 rounded-lg border px-2 text-sm"
            value={params.get("sort") ?? "featured"}
            onChange={(e) => push({ sort: e.target.value === "featured" ? null : e.target.value })}
            aria-label="Sort by"
          >
            {Object.entries(SORTS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
