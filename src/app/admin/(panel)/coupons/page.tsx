import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/admin/filter-bar";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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
import { listCoupons } from "@/server/services/coupon-admin";

export const metadata: Metadata = { title: "Coupons" };

// A15 coupons
export default async function CouponsPage() {
  await requirePagePermission("coupons.manage");
  const coupons = await listCoupons(db);
  const money = (n: number) => formatMoney(n, env.STORE_CURRENCY);
  const now = new Date();
  const state = (c: (typeof coupons)[number]) =>
    !c.isActive
      ? "Disabled"
      : c.endsAt && c.endsAt <= now
        ? "Expired"
        : c.startsAt && c.startsAt > now
          ? "Scheduled"
          : c.usageLimit !== null && c.stats.uses >= c.usageLimit
            ? "Used up"
            : "Active";
  return (
    <>
      <PageHeader
        title="Coupons"
        actions={
          <Link href="/admin/coupons/new" className={buttonVariants()}>
            New coupon
          </Link>
        }
      />
      {coupons.length === 0 ? (
        <EmptyState title="No coupons yet" />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Uses</TableHead>
                <TableHead className="hidden text-right md:table-cell">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link
                      href={`/admin/coupons/${c.id}`}
                      className="font-mono font-medium hover:underline"
                    >
                      {c.code}
                    </Link>
                  </TableCell>
                  <TableCell>{c.type === "PERCENT" ? `${c.value}%` : money(c.value)}</TableCell>
                  <TableCell>
                    <Badge variant={state(c) === "Active" ? "default" : "outline"}>
                      {state(c)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.stats.uses}
                    {c.usageLimit !== null ? ` / ${c.usageLimit}` : ""}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">
                    {money(c.stats.revenue)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
