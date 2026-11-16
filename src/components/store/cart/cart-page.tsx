"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/money";

import { useCart } from "./cart-context";
import { CartLines, CartNotices } from "./cart-lines";
import { CouponForm } from "./coupon-form";

// S8 cart
export function CartPage() {
  const { cart, currency } = useCart();
  if (!cart) {
    return (
      <div className="flex flex-col gap-3" aria-label="Loading cart">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (cart.lines.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <CartNotices notices={cart.notices} />
        <p className="text-muted-foreground">Your cart is empty.</p>
        <Link href="/shop" className={buttonVariants()}>
          Start shopping
        </Link>
      </div>
    );
  }
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <div className="flex flex-col gap-3">
        <CartNotices notices={cart.notices} />
        <CartLines cart={cart} />
      </div>
      <aside
        className="bg-card flex h-fit flex-col gap-4 rounded-xl border p-5 lg:sticky lg:top-24"
        aria-label="Order summary"
      >
        <h2 className="font-heading text-2xl">Summary</h2>
        <CouponForm />
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd className="tabular-nums">{formatMoney(cart.subtotal, currency)}</dd>
          </div>
          {cart.discountTotal > 0 ? (
            <div className="flex justify-between text-emerald-800">
              <dt>Discount</dt>
              <dd className="tabular-nums">−{formatMoney(cart.discountTotal, currency)}</dd>
            </div>
          ) : null}
          <div className="text-muted-foreground flex justify-between">
            <dt>Delivery</dt>
            <dd>At checkout</dd>
          </div>
          <div className="flex justify-between border-t pt-2 text-base font-medium">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatMoney(cart.total, currency)}</dd>
          </div>
        </dl>
        <Link
          href="/checkout"
          className={buttonVariants({ size: "lg", className: "h-11 text-base" })}
        >
          Checkout
        </Link>
        <p className="text-muted-foreground text-xs">Prices include tax.</p>
      </aside>
    </div>
  );
}
