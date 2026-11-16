import type { Metadata } from "next";
import { Suspense } from "react";

import { OrderList } from "@/components/store/account/order-list";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { listOrdersForUser } from "@/server/services/account";

export const metadata: Metadata = { title: "Orders" };

// S19
export default function OrdersPage() {
  return (
    <Suspense fallback={<Skeleton className="h-48 w-full" />}>
      <Orders />
    </Suspense>
  );
}

async function Orders() {
  const user = await requireUser("/account/orders");
  return <OrderList orders={await listOrdersForUser(db, user.id)} />;
}
