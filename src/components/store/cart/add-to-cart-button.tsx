"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import { useCart } from "./cart-context";

export function AddToCartButton({
  variantId,
  quantity,
  disabled,
}: {
  variantId: string | undefined;
  quantity: number;
  disabled?: boolean;
}) {
  const { add } = useCart();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="lg"
      className="h-11 flex-1 text-base"
      disabled={!variantId || disabled || busy}
      onClick={async () => {
        if (!variantId) return;
        setBusy(true);
        await add(variantId, quantity);
        setBusy(false);
      }}
    >
      {busy ? "Adding…" : "Add to cart"}
    </Button>
  );
}
