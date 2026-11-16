import type { Metadata } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Payment cancelled", robots: { index: false } };

// S12. The order stays unpaid and expires; the cart is untouched.
export default function CancelledPage() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-20 text-center">
      <h1 className="font-heading text-4xl">Payment not completed</h1>
      <p className="text-muted-foreground">
        You have not been charged. Your cart is saved, so you can try again whenever you are ready.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/checkout" className={buttonVariants()}>
          Return to checkout
        </Link>
        <Link href="/cart" className={buttonVariants({ variant: "outline" })}>
          View cart
        </Link>
      </div>
    </div>
  );
}
