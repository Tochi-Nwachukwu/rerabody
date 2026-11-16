import Link from "next/link";
import { Suspense } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { OrderList } from "@/components/store/account/order-list";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { listOrdersForUser } from "@/server/services/account";

// S18 account overview
export default function AccountPage() {
  return (
    <Suspense fallback={<Skeleton className="h-48 w-full" />}>
      <Overview />
    </Suspense>
  );
}

async function Overview() {
  const user = await requireUser("/account");
  const [orders, addressCount] = await Promise.all([
    listOrdersForUser(db, user.id, 3),
    db.address.count({ where: { userId: user.id } }),
  ]);
  return (
    <div className="flex flex-col gap-8">
      <p>Hello, {user.name}.</p>
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl">Recent orders</h2>
          <Link href="/account/orders" className="text-sm underline underline-offset-4">
            All orders
          </Link>
        </div>
        <OrderList orders={orders} />
      </section>
      <section className="grid gap-3 sm:grid-cols-2">
        <Link href="/account/addresses" className="hover:bg-muted/50 rounded-xl border p-4">
          <p className="font-medium">Addresses</p>
          <p className="text-muted-foreground text-sm">{addressCount} saved</p>
        </Link>
        <Link href="/account/profile" className="hover:bg-muted/50 rounded-xl border p-4">
          <p className="font-medium">Profile and password</p>
          <p className="text-muted-foreground text-sm">{user.email}</p>
        </Link>
      </section>
      <SignOutButton className="self-start" />
    </div>
  );
}
