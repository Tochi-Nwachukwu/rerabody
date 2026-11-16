import type { Metadata } from "next";

import { CartPage } from "@/components/store/cart/cart-page";
import { PageTitle } from "@/components/store/page-title";

export const metadata: Metadata = { title: "Cart", robots: { index: false } };

// S8
export default function Cart() {
  return (
    <>
      <PageTitle title="Your cart" />
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <CartPage />
      </div>
    </>
  );
}
