import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { OrderView } from "@/components/store/order-view";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { getSiteSettings } from "@/server/queries/settings";
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
    </div>
  );
}
