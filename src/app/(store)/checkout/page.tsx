import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { CheckoutForm } from "@/components/store/checkout/checkout-form";
import { PageTitle } from "@/components/store/page-title";
import { Skeleton } from "@/components/ui/skeleton";
import { env } from "@/env";
import { getSession } from "@/server/auth/session";
import { formatStoreMoney, getCartIdentity } from "@/server/cart-session";
import { db } from "@/server/db";
import { getActiveShippingMethods } from "@/server/queries/shipping";
import { loadCart } from "@/server/services/cart";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

// S9
export default function CheckoutPage() {
  return (
    <>
      <PageTitle title="Checkout" />
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <Checkout />
        </Suspense>
      </div>
    </>
  );
}

async function Checkout() {
  const [session, identity, shippingMethods] = await Promise.all([
    getSession(),
    getCartIdentity(),
    getActiveShippingMethods(),
  ]);
  const cart = await loadCart(db, identity, {
    now: new Date(),
    format: formatStoreMoney,
    email: identity.email,
  });
  if (cart.lines.length === 0) redirect("/cart");
  const addresses = session
    ? await db.address.findMany({
        where: { userId: session.user.id },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      })
    : [];
  return (
    <CheckoutForm
      cart={cart}
      currency={env.STORE_CURRENCY}
      taxAtPayment={env.PAYMENT_PROVIDER === "stripe" && env.STRIPE_AUTOMATIC_TAX}
      shippingMethods={shippingMethods}
      user={session ? { email: session.user.email, name: session.user.name } : null}
      savedAddresses={addresses.map((a) => ({
        id: a.id,
        label: `${a.fullName}, ${a.line1}, ${a.city}`,
        value: {
          fullName: a.fullName,
          phone: a.phone,
          line1: a.line1,
          line2: a.line2 ?? "",
          city: a.city,
          state: a.state ?? "",
          postalCode: a.postalCode ?? "",
          country: a.country,
        },
      }))}
    />
  );
}
