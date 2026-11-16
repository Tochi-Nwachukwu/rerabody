import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Report definitions (A3, A27). Dates are UTC. An order counts once it is
 * paid (by paidAt). Net revenue = order totals minus refunds; cancelled or
 * fully refunded orders therefore net to zero and are not counted as orders.
 */
export type Range = { from: Date; to: Date };
export type Granularity = "day" | "week" | "month";

const COUNTED = ["PAID", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];

export async function salesReport(
  prisma: PrismaClient,
  range: Range,
  granularity: Granularity = "day",
) {
  const totals = await prisma.$queryRaw<
    { gross: bigint | null; refunds: bigint | null; orders: bigint; countedGross: bigint | null }[]
  >`
    SELECT
      SUM(o.total) AS gross,
      SUM(COALESCE(p.refunded, 0)) AS refunds,
      COUNT(*) FILTER (WHERE o.status::text = ANY(${COUNTED})) AS orders,
      SUM(o.total) FILTER (WHERE o.status::text = ANY(${COUNTED})) AS "countedGross"
    FROM "Order" o
    LEFT JOIN (SELECT "orderId", SUM("refundedAmount") AS refunded FROM "Payment" GROUP BY "orderId") p ON p."orderId" = o.id
    WHERE o."paidAt" >= ${range.from} AND o."paidAt" < ${range.to}`;
  const series = await prisma.$queryRaw<{ bucket: Date; revenue: bigint; orders: bigint }[]>`
    SELECT date_trunc(${granularity}, o."paidAt" AT TIME ZONE 'UTC') AS bucket,
      SUM(o.total - COALESCE(p.refunded, 0)) AS revenue,
      COUNT(*) FILTER (WHERE o.status::text = ANY(${COUNTED})) AS orders
    FROM "Order" o
    LEFT JOIN (SELECT "orderId", SUM("refundedAmount") AS refunded FROM "Payment" GROUP BY "orderId") p ON p."orderId" = o.id
    WHERE o."paidAt" >= ${range.from} AND o."paidAt" < ${range.to}
    GROUP BY 1 ORDER BY 1`;
  const t = totals[0];
  const orders = Number(t?.orders ?? 0);
  const revenue = Number(t?.gross ?? 0) - Number(t?.refunds ?? 0);
  return {
    revenue,
    refunds: Number(t?.refunds ?? 0),
    orders,
    averageOrderValue: orders ? Math.round(Number(t?.countedGross ?? 0) / orders) : 0,
    series: series.map((s) => ({
      bucket: s.bucket.toISOString().slice(0, 10),
      revenue: Number(s.revenue),
      orders: Number(s.orders),
    })),
  };
}

export async function topProducts(prisma: PrismaClient, range: Range, limit = 10) {
  const rows = await prisma.$queryRaw<
    { productId: string | null; name: string; units: bigint; revenue: bigint }[]
  >`
    SELECT i."productId", MAX(i."productName") AS name, SUM(i.quantity) AS units, SUM(i."lineTotal") AS revenue
    FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId"
    WHERE o."paidAt" >= ${range.from} AND o."paidAt" < ${range.to} AND o.status::text = ANY(${COUNTED})
    GROUP BY i."productId" ORDER BY revenue DESC LIMIT ${limit}`;
  return rows.map((r) => ({
    productId: r.productId,
    name: r.name,
    units: Number(r.units),
    revenue: Number(r.revenue),
  }));
}

export async function customerReport(prisma: PrismaClient, range: Range, limit = 10) {
  const [newCustomers, top] = await Promise.all([
    prisma.user.count({ where: { roleId: null, createdAt: { gte: range.from, lt: range.to } } }),
    prisma.$queryRaw<{ email: string; name: string | null; orders: bigint; spend: bigint }[]>`
      SELECT o.email, MAX(u.name) AS name, COUNT(*) AS orders, SUM(o.total) AS spend
      FROM "Order" o LEFT JOIN "User" u ON u.id = o."userId"
      WHERE o."paidAt" >= ${range.from} AND o."paidAt" < ${range.to} AND o.status::text = ANY(${COUNTED})
      GROUP BY o.email ORDER BY spend DESC LIMIT ${limit}`,
  ]);
  return {
    newCustomers,
    top: top.map((t) => ({
      email: t.email,
      name: t.name,
      orders: Number(t.orders),
      spend: Number(t.spend),
    })),
  };
}

export async function couponReport(prisma: PrismaClient, range: Range) {
  const rows = await prisma.$queryRaw<
    { code: string; uses: bigint; discount: bigint; revenue: bigint }[]
  >`
    SELECT c.code, COUNT(*) AS uses, SUM(r.amount) AS discount, SUM(o.total) AS revenue
    FROM "CouponRedemption" r JOIN "Coupon" c ON c.id = r."couponId" JOIN "Order" o ON o.id = r."orderId"
    WHERE o."paidAt" >= ${range.from} AND o."paidAt" < ${range.to} AND o.status::text = ANY(${COUNTED})
    GROUP BY c.code ORDER BY uses DESC`;
  return rows.map((r) => ({
    code: r.code,
    uses: Number(r.uses),
    discount: Number(r.discount),
    revenue: Number(r.revenue),
  }));
}

/** A3 dashboard figures. */
export async function dashboardFigures(prisma: PrismaClient, now = new Date()) {
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekAgo = new Date(now.getTime() - 7 * 86400_000);
  const [today, awaiting, needsReview, lowStock, pendingReviews, newCustomers, openTickets] =
    await Promise.all([
      salesReport(prisma, { from: startOfDay, to: new Date(startOfDay.getTime() + 86400_000) }),
      prisma.order.count({ where: { status: { in: ["PAID", "PROCESSING"] } } }),
      prisma.order.count({ where: { needsManualReview: true } }),
      prisma.productVariant.findMany({
        where: {
          isActive: true,
          product: { status: "PUBLISHED" },
          stock: { lte: prisma.productVariant.fields.lowStockThreshold },
        },
        orderBy: { stock: "asc" },
        take: 8,
        select: {
          id: true,
          sku: true,
          stock: true,
          optionValues: true,
          product: { select: { id: true, name: true } },
        },
      }),
      prisma.review.count({ where: { status: "PENDING" } }),
      prisma.user.count({ where: { roleId: null, createdAt: { gte: weekAgo } } }),
      prisma.supportTicket.count({ where: { status: "OPEN" } }),
    ]);
  return { today, awaiting, needsReview, lowStock, pendingReviews, newCustomers, openTickets };
}

// CSV --------------------------------------------------------------------------

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  // Prevent spreadsheet formula injection, then quote.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

const toMajor = (digits: number) => (n: number) => (n / 10 ** digits).toFixed(digits);

/** Amounts are written in major units (e.g. 18.50) with the currency's decimal places. */
export async function ordersCsv(prisma: PrismaClient, range: Range, digits = 2) {
  const major = toMajor(digits);
  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: range.from, lt: range.to }, status: { not: "PENDING_PAYMENT" } },
    orderBy: { createdAt: "asc" },
    include: { items: true, payments: { select: { refundedAmount: true } } },
  });
  return toCsv(
    [
      "number",
      "date",
      "status",
      "email",
      "items",
      "subtotal",
      "discount",
      "shipping",
      "total",
      "refunded",
      "currency",
      "coupon",
    ],
    orders.map((o) => [
      o.number,
      o.createdAt.toISOString(),
      o.status,
      o.email,
      o.items.map((i) => `${i.quantity}x ${i.sku}`).join("; "),
      major(o.subtotal),
      major(o.discountTotal),
      major(o.shippingTotal),
      major(o.total),
      major(o.payments.reduce((s, p) => s + p.refundedAmount, 0)),
      o.currency,
      o.couponCode ?? "",
    ]),
  );
}

export async function customersCsv(prisma: PrismaClient, digits = 2) {
  const major = toMajor(digits);
  const users = await prisma.user.findMany({
    where: { roleId: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, phone: true, createdAt: true, status: true },
  });
  const spend = await prisma.order.groupBy({
    by: ["userId"],
    where: { userId: { not: null }, status: { in: COUNTED as never } },
    _sum: { total: true },
    _count: { _all: true },
  });
  const byUser = new Map(spend.map((s) => [s.userId, s]));
  return toCsv(
    ["name", "email", "phone", "joined", "status", "orders", "spend"],
    users.map((u) => [
      u.name,
      u.email,
      u.phone ?? "",
      u.createdAt.toISOString(),
      u.status,
      byUser.get(u.id)?._count._all ?? 0,
      major(byUser.get(u.id)?._sum.total ?? 0),
    ]),
  );
}
