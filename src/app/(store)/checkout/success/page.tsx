import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PaymentPoller } from "@/components/store/checkout/payment-poller";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/money";
import { getSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { findOrderForViewer } from "@/server/services/checkout";

export const metadata: Metadata = { title: "Thank you", robots: { index: false } };

// S11
export default function SuccessPage({ searchParams }: PageProps<"/checkout/success">) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Success searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Success({
  searchParams,
}: {
  searchParams: PageProps<"/checkout/success">["searchParams"];
}) {
  const sp = await searchParams;
  const orderId = typeof sp.order === "string" ? sp.order : "";
  const token = typeof sp.token === "string" ? sp.token : null;
  const session = await getSession();
  const order = orderId
    ? await findOrderForViewer(db, { orderId, token, userId: session?.user.id })
    : null;
  if (!order) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="font-heading text-4xl">We could not find that order</h1>
        <p className="text-muted-foreground">If you paid, check your email for the confirmation.</p>
        <Link href="/" className={buttonVariants()}>
          Back to the store
        </Link>
      </div>
    );
  }

  const waiting = order.status === "PENDING_PAYMENT";
  const paid = !waiting && order.status !== "CANCELLED";
  const trackHref =
    order.userId && session?.user.id === order.userId
      ? `/account/orders/${order.id}`
      : `/orders/track?order=${order.id}&token=${encodeURIComponent(token ?? "")}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">
          Order {order.number}
        </p>
        <h1 className="font-heading text-4xl">
          {paid
            ? "Thank you for your order"
            : waiting
              ? "Almost there"
              : "This order was cancelled"}
        </h1>
        {paid ? (
          <p className="text-muted-foreground">We have emailed a confirmation to {order.email}.</p>
        ) : null}
        <PaymentPoller waiting={waiting} />
      </div>
      <section aria-label="Order details" className="rounded-xl border p-5">
        <ul className="flex flex-col gap-2 text-sm">
          {order.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3">
              <span>
                {i.quantity} × {i.productName}
                {i.variantLabel !== "Default" ? ` (${i.variantLabel})` : ""}
              </span>
              <span className="tabular-nums">{formatMoney(i.lineTotal, order.currency)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 flex flex-col gap-1 border-t pt-3 text-sm">
          {order.discountTotal > 0 ? (
            <div className="flex justify-between">
              <dt>Discount</dt>
              <dd className="tabular-nums">−{formatMoney(order.discountTotal, order.currency)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt>Delivery</dt>
            <dd className="tabular-nums">{formatMoney(order.shippingTotal, order.currency)}</dd>
          </div>
          {order.taxTotal > 0 ? (
            <div className="flex justify-between">
              <dt>Sales tax</dt>
              <dd className="tabular-nums">{formatMoney(order.taxTotal, order.currency)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between text-base font-medium">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatMoney(order.total, order.currency)}</dd>
          </div>
        </dl>
      </section>
      {paid ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <Link href={trackHref} className={buttonVariants({ variant: "outline" })}>
            Track this order
          </Link>
          {!session && !order.userId ? (
            <div className="bg-secondary/50 rounded-xl p-5">
              <p className="font-medium">Save your details for next time</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Create an account to track orders and check out faster.
              </p>
              <Link
                href={`/register?email=${encodeURIComponent(order.email)}`}
                className={buttonVariants({ className: "mt-3" })}
              >
                Create an account
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
