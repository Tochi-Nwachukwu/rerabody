import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { FormMessage } from "@/components/form/text-field";
import { PageTitle } from "@/components/store/page-title";
import { ReviewForm } from "@/components/store/reviews/review-form";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { reviewEligibility } from "@/server/services/reviews";
import { verifySignedValue } from "@/server/signed-links";

export const metadata: Metadata = { title: "Write a review", robots: { index: false } };

// S23: reached from the signed link in the delivered email.
export default function NewReviewPage({ searchParams }: PageProps<"/reviews/new">) {
  return (
    <div className="mx-auto max-w-lg px-4 pb-16 sm:px-6">
      <Suspense fallback={<Skeleton className="mt-16 h-80 w-full" />}>
        <Review searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Review({
  searchParams,
}: {
  searchParams: PageProps<"/reviews/new">["searchParams"];
}) {
  const sp = await searchParams;
  const item = typeof sp.item === "string" ? sp.item : "";
  const sig = typeof sp.sig === "string" ? sp.sig : "";
  if (!item || !verifySignedValue("review", item, sig)) {
    return (
      <>
        <PageTitle title="Write a review" />
        <FormMessage>
          This review link is not valid or has expired. Use the link in your delivery email.
        </FormMessage>
      </>
    );
  }
  const orderItem = await db.orderItem.findUnique({
    where: { id: item },
    select: { productName: true, order: { select: { email: true } } },
  });
  const session = await getSession();
  const here = `/reviews/new?item=${item}&sig=${encodeURIComponent(sig)}`;
  if (!session) {
    return (
      <>
        <PageTitle title={`Review ${orderItem?.productName ?? "your purchase"}`} />
        <div className="flex flex-col items-center gap-4 text-center">
          <p>
            Sign in to leave your review. If you checked out as a guest, create an account with the
            email you ordered with
            {orderItem ? ` (${orderItem.order.email.replace(/(.{2}).*(@.*)/, "$1…$2")})` : ""}.
          </p>
          <div className="flex gap-2">
            <Link href={`/login?next=${encodeURIComponent(here)}`} className={buttonVariants()}>
              Sign in
            </Link>
            <Link href="/register" className={buttonVariants({ variant: "outline" })}>
              Create an account
            </Link>
          </div>
        </div>
      </>
    );
  }
  const check = await reviewEligibility(db, { orderItemId: item, user: session.user });
  if (!check.ok) {
    return (
      <>
        <PageTitle title="Write a review" />
        <FormMessage>{check.reason}</FormMessage>
      </>
    );
  }
  return (
    <>
      <PageTitle title={`Review ${check.product.name}`} />
      <ReviewForm
        orderItemId={item}
        productName={check.product.name}
        productSlug={check.product.slug}
      />
    </>
  );
}
