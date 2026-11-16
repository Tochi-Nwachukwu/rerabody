import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState, FilterBar, FilterSelect } from "@/components/admin/filter-bar";
import { PageHeader } from "@/components/admin/page-header";
import { Pager, firstParam, pageParam } from "@/components/admin/pager";
import { StatusBadge } from "@/components/admin/status-badge";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { OrderStatus } from "@/generated/prisma/client";
import { formatMoney } from "@/lib/money";
import { requirePagePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { listOrdersAdmin } from "@/server/services/orders";

export const metadata: Metadata = { title: "Orders" };

const STATUSES: OrderStatus[] = [
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
  "PENDING_PAYMENT",
];

function day(v: string | undefined, end = false) {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const d = new Date(`${v}T00:00:00Z`);
  if (end) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

// A10 orders list
export default async function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  await requirePagePermission("orders.read");
  const sp = await searchParams;
  const q = firstParam(sp.q)?.trim() || undefined;
  const status = STATUSES.find((s) => s === firstParam(sp.status));
  const review = firstParam(sp.review) === "1";
  const fromText = firstParam(sp.from);
  const toText = firstParam(sp.to);
  const { items, total, page, pageCount } = await listOrdersAdmin(db, {
    q,
    status,
    review,
    from: day(fromText),
    to: day(toText, true),
    page: pageParam(sp.page),
  });

  return (
    <>
      <PageHeader
        title="Orders"
        description={`${total} order${total === 1 ? "" : "s"}${status ? "" : " (unpaid checkouts hidden)"}`}
      />
      <FilterBar action="/admin/orders" q={q} placeholder="Order number or email">
        <FilterSelect
          name="status"
          label="Status"
          value={status}
          options={STATUSES.map((s) => ({ value: s, label: s.replaceAll("_", " ").toLowerCase() }))}
        />
        <FilterSelect
          name="review"
          label="Review"
          value={review ? "1" : undefined}
          options={[{ value: "1", label: "Needs review" }]}
        />
        <Input
          type="date"
          name="from"
          defaultValue={fromText}
          aria-label="From date"
          className="sm:w-40"
        />
        <Input
          type="date"
          name="to"
          defaultValue={toText}
          aria-label="To date"
          className="sm:w-40"
        />
      </FilterBar>
      {items.length === 0 ? (
        <EmptyState title="No orders match" />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Customer</TableHead>
                <TableHead className="hidden sm:table-cell">Date</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <Link href={`/admin/orders/${o.id}`} className="font-medium hover:underline">
                      {o.number}
                    </Link>
                    {o.needsManualReview ? (
                      <Badge variant="destructive" className="ml-2">
                        Review
                      </Badge>
                    ) : null}
                    <p className="text-muted-foreground text-xs">
                      {o._count.items} item{o._count.items === 1 ? "" : "s"}
                    </p>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={o.status} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <p>{(o.shippingAddress as { fullName?: string }).fullName}</p>
                    <p className="text-muted-foreground text-xs">{o.email}</p>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {o.createdAt.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(o.total, o.currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pager
        page={page}
        pageCount={pageCount}
        params={{ q, status, review: review ? "1" : undefined, from: fromText, to: toText }}
        basePath="/admin/orders"
      />
    </>
  );
}
