"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatMoney } from "@/lib/money";

import { useCart } from "./cart-context";
import { CartLines, CartNotices } from "./cart-lines";

/** Header cart button with the item count. */
export function CartButton() {
  const { cart, setOpen } = useCart();
  const count = cart?.count ?? 0;
  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}
      onClick={() => setOpen(true)}
    >
      <ShoppingBag />
      {count > 0 ? (
        <span
          aria-hidden
          className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 flex size-4.5 items-center justify-center rounded-full text-[10px] font-semibold"
        >
          {count > 99 ? "99" : count}
        </span>
      ) : null}
    </Button>
  );
}

// G3 cart drawer
export function CartDrawer() {
  const { cart, open, setOpen, currency } = useCart();
  const close = () => setOpen(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Your cart</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4">
          {cart?.notices.length ? <CartNotices notices={cart.notices} /> : null}
          {!cart || cart.lines.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-muted-foreground">Your cart is empty.</p>
              <Link href="/shop" onClick={close} className={buttonVariants({ variant: "outline" })}>
                Start shopping
              </Link>
            </div>
          ) : (
            <CartLines cart={cart} onNavigate={close} compact />
          )}
        </div>
        {cart && cart.lines.length > 0 ? (
          <SheetFooter className="border-t">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span className="font-medium tabular-nums">
                {formatMoney(cart.subtotal, currency)}
              </span>
            </div>
            {cart.coupon ? (
              <div className="flex justify-between text-sm text-emerald-800">
                <span>Code {cart.coupon.code}</span>
                <span className="tabular-nums">−{formatMoney(cart.discountTotal, currency)}</span>
              </div>
            ) : null}
            <p className="text-muted-foreground text-xs">Delivery is calculated at checkout.</p>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/cart"
                onClick={close}
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                View cart
              </Link>
              <Link href="/checkout" onClick={close} className={buttonVariants({ size: "lg" })}>
                Checkout
              </Link>
            </div>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
