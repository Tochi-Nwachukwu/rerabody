import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { FakePayButtons } from "@/components/store/checkout/fake-pay-buttons";
import { env } from "@/env";
import { formatMoney } from "@/lib/money";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Test payment", robots: { index: false } };

/** Stand-in for the Stripe hosted page when PAYMENT_PROVIDER=fake. */
export default function FakePayPage({ searchParams }: PageProps<"/checkout/fake-pay">) {
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <Suspense>
        <FakePay searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function FakePay({
  searchParams,
}: {
  searchParams: PageProps<"/checkout/fake-pay">["searchParams"];
}) {
  if (env.PAYMENT_PROVIDER !== "fake") notFound();
  const sp = await searchParams;
  const session = typeof sp.session === "string" ? sp.session : "";
  const payment = session
    ? await db.payment.findUnique({
        where: { providerSessionId: session },
        include: { order: true },
      })
    : null;
  if (!payment) notFound();
  return (
    <div className="flex flex-col gap-4 rounded-xl border p-6">
      <p className="text-xs tracking-wide text-amber-800 uppercase">Test mode: no money moves</p>
      <h1 className="font-heading text-3xl">
        Pay {formatMoney(payment.amount, payment.order.currency)}
      </h1>
      <p className="text-muted-foreground text-sm">Order {payment.order.number}</p>
      <FakePayButtons
        session={session}
        success={String(sp.success ?? "")}
        cancel={String(sp.cancel ?? "")}
      />
    </div>
  );
}
