import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState, FilterBar } from "@/components/admin/filter-bar";
import { PageHeader } from "@/components/admin/page-header";
import { Pager, firstParam, pageParam } from "@/components/admin/pager";
import { StatusBadge } from "@/components/admin/status-badge";
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
import { requirePagePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { listCustomers } from "@/server/services/customers";

export const metadata: Metadata = { title: "Customers" };

// A12 customers
export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  await requirePagePermission("customers.read");
  const sp = await searchParams;
  const q = firstParam(sp.q)?.trim() || undefined;
  const { items, total, page, pageCount } = await listCustomers(db, {
    q,
    page: pageParam(sp.page),
  });
  return (
    <>
      <PageHeader
        title="Customers"
        description={`${total} registered customer${total === 1 ? "" : "s"}. Guest orders appear under Orders.`}
      />
      <FilterBar action="/admin/customers" q={q} placeholder="Name or email" />
      {items.length === 0 ? (
        <EmptyState title="No customers match" />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="hidden sm:table-cell">Joined</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Spend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/admin/customers/${c.id}`} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                    {c.status !== "ACTIVE" ? (
                      <span className="ml-2">
                        <StatusBadge status={c.status} />
                      </span>
                    ) : null}
                    <p className="text-muted-foreground text-xs">{c.email}</p>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {c.createdAt.toLocaleDateString("en-GB", { dateStyle: "medium" })}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{c.orders}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(c.spend, env.STORE_CURRENCY)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pager page={page} pageCount={pageCount} params={{ q }} basePath="/admin/customers" />
    </>
  );
}
