import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CouponEditor } from "@/components/admin/coupons/coupon-editor";
import { PageHeader } from "@/components/admin/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { env } from "@/env";
import type { CouponInput } from "@/lib/schemas/coupon";
import { formatMoney } from "@/lib/money";
import { requirePagePermission } from "@/server/auth/session";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Coupon" };

const local = (d: Date | null) =>
  d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : null;

// A16 coupon detail and redemptions ("new" creates one)
export default async function CouponPage({ params }: PageProps<"/admin/coupons/[id]">) {
  await requirePagePermission("coupons.manage");
  const { id } = await params;
  const [products, categories] = await Promise.all([
    db.product.findMany({
      where: { status: { not: "ARCHIVED" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.category.findMany({ orderBy: { position: "asc" }, select: { id: true, name: true } }),
  ]);
  if (id === "new") {
    const blank: CouponInput = {
      code: "",
      type: "PERCENT",
      value: 10,
      startsAt: null,
      endsAt: null,
      minSpend: null,
      usageLimit: null,
      perCustomerLimit: 1,
      isActive: true,
      showOnOffers: false,
      restrictedProductIds: [],
      restrictedCategoryIds: [],
    };
    return (
      <>
        <PageHeader title="New coupon" />
        <CouponEditor
          initial={blank}
          products={products}
          categories={categories}
          currency={env.STORE_CURRENCY}
        />
      </>
    );
  }
  const coupon = await db.coupon.findUnique({
    where: { id },
    include: {
      redemptions: {
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { order: { select: { id: true, number: true, total: true, status: true } } },
      },
    },
  });
  if (!coupon) notFound();
  const money = (n: number) => formatMoney(n, env.STORE_CURRENCY);
  return (
    <>
      <PageHeader
        title={coupon.code}
        description={`${coupon.redemptions.length} redemption${coupon.redemptions.length === 1 ? "" : "s"}`}
      />
      <div className="grid gap-8 xl:grid-cols-2">
        <CouponEditor
          products={products}
          categories={categories}
          currency={env.STORE_CURRENCY}
          initial={{ ...coupon, startsAt: local(coupon.startsAt), endsAt: local(coupon.endsAt) }}
        />
        <section>
          <h2 className="mb-3 font-semibold">Redemptions</h2>
          {coupon.redemptions.length === 0 ? (
            <p className="text-muted-foreground text-sm">Not used yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Discount</TableHead>
                    <TableHead className="text-right">Order total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coupon.redemptions.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Link href={`/admin/orders/${r.order.id}`} className="hover:underline">
                          {r.order.number}
                        </Link>
                        <p className="text-muted-foreground text-xs">
                          {r.createdAt.toLocaleDateString("en-GB")}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm">{r.email}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(r.amount)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(r.order.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
