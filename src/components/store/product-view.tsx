"use client";

import { Minus, Plus } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { Price } from "./price";
import { type GalleryImage, ProductGallery } from "./product-gallery";

export type ViewVariant = {
  id: string;
  optionValues: Record<string, string>;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  lowStockThreshold: number;
  imageId: string | null;
};

function stockState(v: ViewVariant | undefined) {
  if (!v) return { label: "Choose options", tone: "muted" as const };
  if (v.stock <= 0) return { label: "Sold out", tone: "bad" as const };
  if (v.stock <= v.lowStockThreshold)
    return { label: `Only ${v.stock} left`, tone: "warn" as const };
  return { label: "In stock", tone: "good" as const };
}

// S5 variant selection, price, stock state and add to cart
export function ProductView({
  name,
  images,
  options,
  variants,
  currency,
  initialVariantId,
  header,
}: {
  name: string;
  images: GalleryImage[];
  options: { name: string; values: string[] }[];
  variants: ViewVariant[];
  currency: string;
  initialVariantId?: string;
  header: ReactNode;
}) {
  const initial =
    variants.find((v) => v.id === initialVariantId) ??
    variants.find((v) => v.stock > 0) ??
    variants[0];
  const [selected, setSelected] = useState<Record<string, string>>(initial?.optionValues ?? {});
  const [quantity, setQuantity] = useState(1);
  const variant = useMemo(
    () => variants.find((v) => options.every((o) => v.optionValues[o.name] === selected[o.name])),
    [variants, options, selected],
  );
  const [imageIndex, setImageIndex] = useState(() =>
    Math.max(
      0,
      images.findIndex((i) => i.id === initial?.imageId),
    ),
  );

  useEffect(() => {
    if (!variant) return;
    const url = new URL(window.location.href);
    url.searchParams.set("variant", variant.id);
    window.history.replaceState(null, "", url);
  }, [variant]);

  function choose(option: string, value: string) {
    const next = { ...selected, [option]: value };
    setSelected(next);
    setQuantity(1);
    const match = variants.find((v) =>
      options.every((o) => v.optionValues[o.name] === next[o.name]),
    );
    const idx = match?.imageId ? images.findIndex((i) => i.id === match.imageId) : -1;
    if (idx >= 0) setImageIndex(idx);
  }

  function valueState(option: string, value: string) {
    const candidates = variants.filter(
      (v) =>
        v.optionValues[option] === value &&
        options.every((o) => o.name === option || v.optionValues[o.name] === selected[o.name]),
    );
    return { exists: candidates.length > 0, inStock: candidates.some((v) => v.stock > 0) };
  }

  const state = stockState(variant);
  const maxQty = variant ? Math.max(1, Math.min(variant.stock, 20)) : 1;

  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
      <ProductGallery
        images={images}
        index={imageIndex}
        onIndexChange={setImageIndex}
        name={name}
      />
      <div className="flex flex-col gap-6">
        {header}
        {variant ? (
          <Price
            amount={variant.price}
            compareAt={variant.compareAtPrice}
            currency={currency}
            className="text-xl"
          />
        ) : null}
        {options.map((o) => (
          <fieldset key={o.name} className="flex flex-col gap-2">
            <legend className="mb-2 text-sm">
              {o.name}: <span className="font-medium">{selected[o.name] ?? "Choose"}</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {o.values.map((value) => {
                const { exists, inStock } = valueState(o.name, value);
                const active = selected[o.name] === value;
                return (
                  <button
                    key={value}
                    type="button"
                    disabled={!exists}
                    aria-pressed={active}
                    aria-label={`${value}${!inStock ? ", sold out" : ""}`}
                    onClick={() => choose(o.name, value)}
                    className={cn(
                      "focus-visible:ring-ring/50 min-w-12 rounded-lg border px-3 py-2 text-sm transition-colors focus-visible:ring-3 focus-visible:outline-none disabled:opacity-40",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "hover:border-foreground",
                      !inStock && "line-through decoration-1",
                    )}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
        <p
          className={cn(
            "text-sm font-medium",
            state.tone === "bad" && "text-destructive",
            state.tone === "warn" && "text-amber-800",
            state.tone === "good" && "text-emerald-800",
          )}
          aria-live="polite"
        >
          {state.label}
        </p>
        {variant && variant.stock > 0 ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div
              className="flex w-fit items-center rounded-lg border"
              role="group"
              aria-label="Quantity"
            >
              <Button
                variant="ghost"
                size="icon"
                aria-label="Decrease quantity"
                disabled={quantity <= 1}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                <Minus />
              </Button>
              <span
                className="w-10 text-center tabular-nums"
                aria-live="polite"
                aria-label={`Quantity ${quantity}`}
              >
                {quantity}
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Increase quantity"
                disabled={quantity >= maxQty}
                onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
              >
                <Plus />
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
