import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { OrderView } from "@/components/store/order-view";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { getSiteSettings } from "@/server/queries/settings";
import { reviewLink } from "@/server/notifications/orders";
import { getOrderView } from "@/server/services/account";

export const metadata: Metadata = { title: "Order" };

// S20
export default function OrderPage({ params }: PageProps<"/account/orders/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <Order params={params} />
    </Suspense>
  );
}

async function Order({ params }: { params: PageProps<"/account/orders/[id]">["params"] }) {
  const { id } = await params;
  const user = await requireUser(`/account/orders/${id}`);
  const [order, settings] = await Promise.all([getOrderView(db, id), getSiteSettings()]);
  if (!order || order.userId !== user.id || order.status === "PENDING_PAYMENT") notFound();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-3xl">Order {order.number}</h2>
        <Link href="/account/orders" className="text-sm underline underline-offset-4">
          All orders
        </Link>
      </div>
      <OrderView order={order} tracking={settings.tracking} />
      {order.status === "DELIVERED" ? (
        <section aria-labelledby="review" className="rounded-xl border p-5">
          <h2 id="review" className="font-heading mb-2 text-2xl">
            Tell us what you think
          </h2>
          <ul className="flex flex-col gap-1 text-sm">
            {order.items
              .filter(
                (i, idx, all) =>
                  i.productId && all.findIndex((x) => x.productId === i.productId) === idx,
              )
              .map((i) => (
                <li key={i.id}>
                  <Link href={reviewLink(i.id)} className="underline underline-offset-4">
                    Review {i.productName}
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
