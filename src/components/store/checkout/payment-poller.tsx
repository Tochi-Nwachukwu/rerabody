"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useCart } from "@/components/store/cart/cart-context";

/** Re-renders the success page until the webhook marks the order paid. Never changes order state (rule 1). */
export function PaymentPoller({ waiting }: { waiting: boolean }) {
  const router = useRouter();
  const { refresh } = useCart();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!waiting) {
      refresh();
      return;
    }
    const started = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - started > 90_000) {
        setTimedOut(true);
        clearInterval(timer);
        return;
      }
      router.refresh();
    }, 2000);
    return () => clearInterval(timer);
  }, [waiting, router, refresh]);

  if (!waiting) return null;
  return (
    <p role="status" className="text-muted-foreground text-sm">
      {timedOut
        ? "This is taking longer than usual. You will receive an email as soon as your payment is confirmed."
        : "Confirming your payment. This page updates on its own."}
    </p>
  );
}
