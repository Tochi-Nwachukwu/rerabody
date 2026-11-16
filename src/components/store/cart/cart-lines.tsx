"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import type { CartView } from "@/server/services/cart";

import { useCart } from "./cart-context";

export function CartNotices({ notices }: { notices: string[] }) {
  if (!notices.length) return null;
  return (
    <ul
      role="status"
      className="flex flex-col gap-1 rounded-lg border border-amber-700/30 bg-amber-50 px-3 py-2 text-sm text-amber-900"
    >
      {notices.map((n) => (
        <li key={n}>{n}</li>
      ))}
    </ul>
  );
}

export function CartLines({
  cart,
  onNavigate,
  compact = false,
}: {
  cart: CartView;
  onNavigate?: () => void;
  compact?: boolean;
}) {
  const { currency, setQuantity, remove, pending } = useCart();
  return (
    <ul className="flex flex-col divide-y">
      {cart.lines.map((line) => (
        <li key={line.id} className="flex gap-3 py-4">
          <Link
            href={`/products/${line.productSlug}`}
            onClick={onNavigate}
            className="bg-muted relative size-20 shrink-0 overflow-hidden rounded-md sm:size-24"
          >
            {line.image ? (
              <Image
                src={line.image.url}
                alt={line.image.alt ?? line.productName}
                fill
                sizes="96px"
                className="object-cover"
              />
            ) : null}
          </Link>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex justify-between gap-2">
              <div className="min-w-0">
                <Link
                  href={`/products/${line.productSlug}`}
                  onClick={onNavigate}
                  className="text-sm font-medium hover:underline"
                >
                  {line.productName}
                </Link>
                {line.variantLabel !== "Default" ? (
                  <p className="text-muted-foreground text-xs">{line.variantLabel}</p>
                ) : null}
                {!compact ? (
                  <p className="text-muted-foreground text-xs">
                    {formatMoney(line.unitPrice, currency)} each
                  </p>
                ) : null}
              </div>
              <p className="text-sm font-medium tabular-nums">
                {formatMoney(line.lineTotal, currency)}
              </p>
            </div>
            <div className="mt-auto flex items-center justify-between">
              <div
                className="flex items-center rounded-lg border"
                role="group"
                aria-label={`Quantity of ${line.productName}`}
              >
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Decrease quantity"
                  disabled={pending}
                  onClick={() => setQuantity(line.id, line.quantity - 1)}
                >
                  <Minus />
                </Button>
                <span className="w-8 text-center text-sm tabular-nums">{line.quantity}</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Increase quantity"
                  disabled={pending || line.quantity >= line.maxQuantity}
                  onClick={() => setQuantity(line.id, line.quantity + 1)}
                >
                  <Plus />
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => remove(line.id)}
                aria-label={`Remove ${line.productName}`}
              >
                <Trash2 /> <span className="sr-only sm:not-sr-only">Remove</span>
              </Button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
