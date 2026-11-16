import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CustomerForm } from "@/components/admin/customers/customer-form";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { Stars } from "@/components/store/stars";
import { env } from "@/env";
import { formatMoney } from "@/lib/money";
import { requirePagePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { getCustomer } from "@/server/services/customers";

export const metadata: Metadata = { title: "Customer" };

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-card rounded-xl border p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

// A13 customer profile
export default async function CustomerPage({ params }: PageProps<"/admin/customers/[id]">) {
  const staff = await requirePagePermission("customers.read");
  const { id } = await params;
  const c = await getCustomer(db, id);
  if (!c) notFound();
  const money = (n: number) => formatMoney(n, env.STORE_CURRENCY);
  return (
    <>
      <PageHeader title={c.name} description={c.email} />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-3 gap-3">
            <Card title="Orders">
              <p className="text-2xl font-semibold tabular-nums">{c.orders.length}</p>
            </Card>
            <Card title="Total spend">
              <p className="text-2xl font-semibold tabular-nums">{money(c.spend)}</p>
            </Card>
            <Card title="Joined">
              <p className="text-sm">
                {c.createdAt.toLocaleDateString("en-GB", { dateStyle: "medium" })}
              </p>
            </Card>
          </div>
          <Card title="Orders">
            {c.orders.length === 0 ? (
              <p className="text-muted-foreground text-sm">No orders yet.</p>
            ) : (
              <ul className="flex flex-col divide-y text-sm">
                {c.orders.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-3 py-2">
                    <Link href={`/admin/orders/${o.id}`} className="font-medium hover:underline">
                      {o.number}
                    </Link>
                    <span className="text-muted-foreground">
                      {o.createdAt.toLocaleDateString("en-GB")}
                    </span>
                    <StatusBadge status={o.status} />
                    <span className="tabular-nums">{formatMoney(o.total, o.currency)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Reviews">
            {c.reviews.length === 0 ? (
              <p className="text-muted-foreground text-sm">No reviews.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {c.reviews.map((r) => (
                  <li key={r.id} className="flex items-center gap-2">
                    <Stars rating={r.rating} /> {r.product.name} <StatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <aside className="flex flex-col gap-6">
          <Card title="Details">
            <p className="mb-3 text-sm">
              Email {c.emailVerified ? "verified" : "not verified"} · Newsletter:{" "}
              {c.newsletter ? c.newsletter.toLowerCase() : "not subscribed"}
            </p>
            {staff.permissions.has("customers.update") ? (
              <CustomerForm id={c.id} name={c.name} phone={c.phone ?? ""} status={c.status} />
            ) : (
              <p className="text-sm">{c.phone ?? "No phone"}</p>
            )}
          </Card>
          <Card title="Addresses">
            {c.addresses.length === 0 ? (
              <p className="text-muted-foreground text-sm">None saved.</p>
            ) : (
              <ul className="flex flex-col gap-3 text-sm">
                {c.addresses.map((a) => (
                  <li key={a.id}>
                    {a.fullName}, {a.line1}, {a.city} {a.postalCode}{" "}
                    {a.isDefault ? (
                      <span className="text-muted-foreground text-xs">(default)</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}
