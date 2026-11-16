import type { Metadata } from "next";
import { Suspense } from "react";

import { PageTitle } from "@/components/store/page-title";
import { OrderView } from "@/components/store/order-view";
import { TrackForm } from "@/components/store/track-form";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/server/db";
import { getSiteSettings } from "@/server/queries/settings";
import { getOrderView } from "@/server/services/account";
import { verifySignedValue } from "@/server/signed-links";
import { tokenMatchesHash } from "@/server/tokens";

export const metadata: Metadata = { title: "Track your order", robots: { index: false } };

// S24 guest order tracking: a signed link from an email, the random token from checkout, or number plus email.
export default function TrackPage({ searchParams }: PageProps<"/orders/track">) {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Track searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Track({
  searchParams,
}: {
  searchParams: PageProps<"/orders/track">["searchParams"];
}) {
  const sp = await searchParams;
  const id = typeof sp.order === "string" ? sp.order : null;
  const sig = typeof sp.sig === "string" ? sp.sig : null;
  const token = typeof sp.token === "string" ? sp.token : null;
  const order = id ? await getOrderView(db, id) : null;
  const allowed =
    !!order &&
    order.status !== "PENDING_PAYMENT" &&
    (verifySignedValue("order", order.id, sig) ||
      (!!token && tokenMatchesHash(token, order.guestAccessTokenHash)));

  if (!order || !allowed) {
    return (
      <>
        <PageTitle title="Track your order">
          <p>Enter your order number and the email you used at checkout.</p>
        </PageTitle>
        <div className="mx-auto max-w-sm">
          <TrackForm />
        </div>
      </>
    );
  }
  const settings = await getSiteSettings();
  return (
    <>
      <PageTitle title={`Order ${order.number}`} />
      <OrderView order={order} tracking={settings.tracking} />
    </>
  );
}
