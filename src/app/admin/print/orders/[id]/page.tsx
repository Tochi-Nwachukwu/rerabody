import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PrintButton } from "@/components/admin/orders/print-button";
import { requirePagePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { getSiteSettings } from "@/server/queries/settings";

export const metadata: Metadata = { title: "Packing slip" };

type Address = {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
};

// Packing slip: printable, no prices.
export default function PackingSlipPage({ params }: PageProps<"/admin/print/orders/[id]">) {
  return (
    <Suspense>
      <Slip params={params} />
    </Suspense>
  );
}

async function Slip({ params }: { params: PageProps<"/admin/print/orders/[id]">["params"] }) {
  await requirePagePermission("orders.read");
  const { id } = await params;
  const [order, settings] = await Promise.all([
    db.order.findUnique({ where: { id }, include: { items: true } }),
    getSiteSettings(),
  ]);
  if (!order) notFound();
  const a = order.shippingAddress as Address;
  return (
    <main id="main" className="mx-auto max-w-2xl bg-white p-8 text-black print:p-0">
      <div className="mb-6 flex items-start justify-between print:hidden">
        <p className="text-sm text-neutral-600">Packing slip preview</p>
        <PrintButton />
      </div>
      <header className="mb-8 flex justify-between">
        <div>
          <p className="font-heading text-2xl font-semibold tracking-[0.12em] uppercase">
            {settings.store.name}
          </p>
          {settings.store.contactEmail ? (
            <p className="text-sm">{settings.store.contactEmail}</p>
          ) : null}
        </div>
        <div className="text-right text-sm">
          <p className="text-lg font-semibold">Order {order.number}</p>
          <p>{order.createdAt.toLocaleDateString("en-GB", { dateStyle: "long" })}</p>
        </div>
      </header>
      <section className="mb-8">
        <h2 className="mb-1 text-sm font-semibold uppercase">Ship to</h2>
        <address className="text-sm not-italic">
          {a.fullName}
          <br />
          {a.line1}
          <br />
          {a.line2 ? (
            <>
              {a.line2}
              <br />
            </>
          ) : null}
          {a.city}
          {a.state ? `, ${a.state}` : ""}
          <br />
          {a.postalCode ? (
            <>
              {a.postalCode}
              <br />
            </>
          ) : null}
          {a.country}
          <br />
          {a.phone}
        </address>
      </section>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="py-2">Item</th>
            <th className="py-2">SKU</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2 text-right">Packed</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((i) => (
            <tr key={i.id} className="border-b">
              <td className="py-2">
                {i.productName}
                {i.variantLabel !== "Default" ? ` (${i.variantLabel})` : ""}
              </td>
              <td className="py-2 font-mono text-xs">{i.sku}</td>
              <td className="py-2 text-right">{i.quantity}</td>
              <td className="py-2 text-right">☐</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-8 text-sm">Thank you for your order.</p>
    </main>
  );
}
