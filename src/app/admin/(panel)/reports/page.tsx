import type { Metadata } from "next";
import Link from "next/link";

import { FilterSelect } from "@/components/admin/filter-bar";
import { PageHeader } from "@/components/admin/page-header";
import { firstParam } from "@/components/admin/pager";
import { BarChart } from "@/components/admin/reports/bar-chart";
import { ExportButtons } from "@/components/admin/reports/export-buttons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { env } from "@/env";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { requirePagePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import {
  type Granularity,
  couponReport,
  customerReport,
  salesReport,
  topProducts,
} from "@/server/services/reports";

export const metadata: Metadata = { title: "Reports" };

const TABS = ["sales", "products", "customers", "coupons"] as const;
const iso = (d: Date) => d.toISOString().slice(0, 10);

// A27 reports: sales, products, customers, coupons, with CSV export
export default async function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  await requirePagePermission("reports.read");
  const sp = await searchParams;
  const tab = TABS.find((t) => t === firstParam(sp.tab)) ?? "sales";
  const today = new Date();
  const fromText = firstParam(sp.from) ?? iso(new Date(today.getTime() - 29 * 86400_000));
  const toText = firstParam(sp.to) ?? iso(today);
  const granularity =
    (["day", "week", "month"] as const).find((g) => g === firstParam(sp.by)) ?? "day";
  const range = {
    from: new Date(`${fromText}T00:00:00Z`),
    to: new Date(new Date(`${toText}T00:00:00Z`).getTime() + 86400_000),
  };
  const money = (n: number) => formatMoney(n, env.STORE_CURRENCY);
  const href = (t: string) =>
    `/admin/reports?tab=${t}&from=${fromText}&to=${toText}&by=${granularity}`;

  return (
    <>
      <PageHeader
        title="Reports"
        description="Paid orders only. Dates are in UTC. Revenue is net of refunds."
        actions={<ExportButtons from={fromText} to={toText} />}
      />
      <form action="/admin/reports" className="mb-4 flex flex-wrap items-end gap-2">
        <input type="hidden" name="tab" value={tab} />
        <label className="flex flex-col gap-1 text-sm">
          From
          <Input type="date" name="from" defaultValue={fromText} className="w-40" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          To
          <Input type="date" name="to" defaultValue={toText} className="w-40" />
        </label>
        <FilterSelect
          name="by"
          label="Group by"
          value={granularity}
          options={[
            { value: "day", label: "Day" },
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
          ]}
        />
        <Button type="submit" variant="outline">
          Apply
        </Button>
      </form>
      <nav aria-label="Report" className="mb-6 flex gap-1 overflow-x-auto border-b">
        {TABS.map((t) => (
          <Link
            key={t}
            href={href(t)}
            aria-current={tab === t ? "page" : undefined}
            className={cn(
              "border-b-2 px-3 py-2 text-sm capitalize",
              tab === t ? "border-primary font-medium" : "text-muted-foreground border-transparent",
            )}
          >
            {t}
          </Link>
        ))}
      </nav>
      {tab === "sales" ? <Sales range={range} granularity={granularity} money={money} /> : null}
      {tab === "products" ? <Products range={range} money={money} /> : null}
      {tab === "customers" ? <Customers range={range} money={money} /> : null}
      {tab === "coupons" ? <Coupons range={range} money={money} /> : null}
    </>
  );
}

type Props = { range: { from: Date; to: Date }; money: (n: number) => string };

async function Sales({ range, granularity, money }: Props & { granularity: Granularity }) {
  const r = await salesReport(db, range, granularity);
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Revenue", money(r.revenue)],
          ["Orders", String(r.orders)],
          ["Average order", money(r.averageOrderValue)],
          ["Refunds", money(r.refunds)],
        ].map(([l, v]) => (
          <div key={l} className="bg-card rounded-xl border p-4">
            <p className="text-muted-foreground text-sm">{l}</p>
            <p className="text-2xl font-semibold tabular-nums">{v}</p>
          </div>
        ))}
      </div>
      <section className="bg-card rounded-xl border p-4">
        <h2 className="mb-3 text-sm font-semibold">Revenue by {granularity}</h2>
        <BarChart
          label={`Revenue by ${granularity}`}
          data={r.series.map((s) => ({ label: s.bucket, value: s.revenue }))}
          format={money}
        />
      </section>
    </div>
  );
}

async function Products({ range, money }: Props) {
  const rows = await topProducts(db, range, 20);
  return (
    <SimpleTable
      head={["Product", "Units", "Revenue"]}
      rows={rows.map((r) => [r.name, String(r.units), money(r.revenue)])}
      empty="No sales in this period."
    />
  );
}

async function Customers({ range, money }: Props) {
  const r = await customerReport(db, range, 20);
  return (
    <div className="flex flex-col gap-6">
      <div className="bg-card w-fit rounded-xl border p-4">
        <p className="text-muted-foreground text-sm">New registered customers</p>
        <p className="text-2xl font-semibold tabular-nums">{r.newCustomers}</p>
      </div>
      <SimpleTable
        head={["Customer", "Orders", "Spend"]}
        rows={r.top.map((t) => [
          t.name ? `${t.name} (${t.email})` : t.email,
          String(t.orders),
          money(t.spend),
        ])}
        empty="No orders in this period."
      />
    </div>
  );
}

async function Coupons({ range, money }: Props) {
  const rows = await couponReport(db, range);
  return (
    <SimpleTable
      head={["Code", "Uses", "Discount given", "Order revenue"]}
      rows={rows.map((r) => [r.code, String(r.uses), money(r.discount), money(r.revenue)])}
      empty="No coupons used in this period."
    />
  );
}

function SimpleTable({ head, rows, empty }: { head: string[]; rows: string[][]; empty: string }) {
  if (!rows.length) return <p className="text-muted-foreground text-sm">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            {head.map((h, i) => (
              <TableHead key={h} className={i ? "text-right" : ""}>
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              {r.map((c, j) => (
                <TableCell key={j} className={j ? "text-right tabular-nums" : ""}>
                  {c}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
