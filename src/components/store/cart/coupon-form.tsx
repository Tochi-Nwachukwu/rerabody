"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/money";

import { useCart } from "./cart-context";

export function CouponForm() {
  const { cart, applyCoupon, removeCoupon, currency, pending } = useCart();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (cart?.coupon) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed px-3 py-2 text-sm">
        <span>
          Code <strong className="font-mono">{cart.coupon.code}</strong> saves{" "}
          {formatMoney(cart.coupon.discount, currency)}
        </span>
        <Button variant="ghost" size="sm" disabled={pending} onClick={removeCoupon}>
          Remove
        </Button>
      </div>
    );
  }
  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!code.trim()) return setError("Enter a code.");
        setBusy(true);
        const err = await applyCoupon(code.trim());
        setBusy(false);
        setError(err);
        if (!err) setCode("");
      }}
    >
      <label htmlFor="coupon" className="text-sm font-medium">
        Promo code
      </label>
      <div className="flex gap-2">
        <Input
          id="coupon"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          autoComplete="off"
          aria-invalid={!!error}
          aria-describedby={error ? "coupon-error" : undefined}
        />
        <Button type="submit" variant="outline" disabled={busy}>
          {busy ? "Checking…" : "Apply"}
        </Button>
      </div>
      {error ? (
        <p id="coupon-error" role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </form>
  );
}
