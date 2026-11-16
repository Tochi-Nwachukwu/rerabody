import type { Metadata } from "next";
import { Suspense } from "react";

import { AddressBook } from "@/components/store/account/address-book";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Addresses" };

// S21
export default function AddressesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-48 w-full" />}>
      <Addresses />
    </Suspense>
  );
}

async function Addresses() {
  const user = await requireUser("/account/addresses");
  const rows = await db.address.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  return (
    <AddressBook
      addresses={rows.map((a) => ({
        id: a.id,
        fullName: a.fullName,
        phone: a.phone,
        line1: a.line1,
        line2: a.line2 ?? "",
        city: a.city,
        state: a.state ?? "",
        postalCode: a.postalCode ?? "",
        country: a.country,
        isDefault: a.isDefault,
      }))}
    />
  );
}
