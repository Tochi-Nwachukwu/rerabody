import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/admin/page-header";
import { FormMessage } from "@/components/form/text-field";
import { env } from "@/env";
import { formatMoney } from "@/lib/money";
import { variantLabel } from "@/lib/variants";
import { requireStaff } from "@/server/auth/session";
import { db } from "@/server/db";
import { dashboardFigures } from "@/server/services/reports";

export const metadata: Metadata = { title: "Dashboard" };

function Tile({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: string | number;
  href?: string;
  tone?: "warn";
}) {
  const inner = (
    <div
      className={`bg-card flex h-full flex-col gap-1 rounded-xl border p-4 ${tone === "warn" ? "border-amber-700/40" : ""}`}
    >
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
  return href ? (
    <Link href={href} className="hover:ring-ring/30 rounded-xl hover:ring-2">
      {inner}
    </Link>
  ) : (
    inner
  );
}

// A3 dashboard: live figures, each linked to where the work happens.
export default async function AdminDashboardPage({ searchParams }: PageProps<"/admin">) {
  const staff = await requireStaff();
  const { denied } = await searchParams;
  const can = (p: Parameters<typeof staff.permissions.has>[0]) => staff.permissions.has(p);
  const f = await dashboardFigures(db);
  const money = (n: number) => formatMoney(n, env.STORE_CURRENCY);
  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Signed in as ${staff.name} (${staff.roleName}).`}
      />
      {denied ? (
        <div className="mb-6">
          <FormMessage>Your role does not include access to that page.</FormMessage>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {can("reports.read") ? (
          <Tile label="Revenue today" value={money(f.today.revenue)} href="/admin/reports" />
        ) : null}
        {can("orders.read") ? (
          <Tile label="Orders today" value={f.today.orders} href="/admin/orders" />
        ) : null}
        {can("orders.read") ? (
          <Tile label="Awaiting fulfilment" value={f.awaiting} href="/admin/orders?status=PAID" />
        ) : null}
        {can("orders.read") && f.needsReview ? (
          <Tile
            label="Orders needing review"
            value={f.needsReview}
            href="/admin/orders?review=1"
            tone="warn"
          />
        ) : null}
        {can("reviews.moderate") ? (
          <Tile label="Reviews to moderate" value={f.pendingReviews} href="/admin/reviews" />
        ) : null}
        {can("support.manage") ? (
          <Tile label="Open tickets" value={f.openTickets} href="/admin/support" />
        ) : null}
        {can("customers.read") ? (
          <Tile label="New customers (7 days)" value={f.newCustomers} href="/admin/customers" />
        ) : null}
      </div>
      {can("inventory.read") ? (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Low stock</h2>
            <Link
              href="/admin/inventory?stock=low"
              className="text-sm underline underline-offset-4"
            >
              See all
            </Link>
          </div>
          {f.lowStock.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nothing is running low.</p>
          ) : (
            <ul className="flex flex-col divide-y rounded-xl border">
              {f.lowStock.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
                >
                  <span>
                    {v.product.name}{" "}
                    <span className="text-muted-foreground">
                      {variantLabel(v.optionValues as Record<string, string>)}
                    </span>
                  </span>
                  <span className={v.stock === 0 ? "text-destructive font-medium" : "font-medium"}>
                    {v.stock} left
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </>
  );
}
