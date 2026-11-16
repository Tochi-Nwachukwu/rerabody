import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { UserError } from "@/server/errors";

import { audit } from "./audit";

export const SPEND_STATUSES = [
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
] as const;

/** A12: registered customers with order count and total spend (paid, not cancelled or refunded). */
export async function listCustomers(prisma: PrismaClient, input: { q?: string; page?: number }) {
  const pageSize = 25;
  const page = Math.max(1, input.page ?? 1);
  const where: Prisma.UserWhereInput = {
    roleId: null,
    ...(input.q
      ? {
          OR: [
            { name: { contains: input.q, mode: "insensitive" } },
            { email: { contains: input.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, name: true, email: true, status: true, createdAt: true },
    }),
    prisma.user.count({ where }),
  ]);
  const spend = users.length
    ? await prisma.order.groupBy({
        by: ["userId"],
        where: { userId: { in: users.map((u) => u.id) }, status: { in: [...SPEND_STATUSES] } },
        _sum: { total: true },
        _count: { _all: true },
      })
    : [];
  const byUser = new Map(
    spend.map((s) => [s.userId, { orders: s._count._all, spend: s._sum.total ?? 0 }]),
  );
  return {
    page,
    total,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    items: users.map((u) => ({ ...u, ...(byUser.get(u.id) ?? { orders: 0, spend: 0 }) })),
  };
}

export async function getCustomer(prisma: PrismaClient, id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      addresses: { orderBy: { isDefault: "desc" } },
      orders: {
        where: { status: { not: "PENDING_PAYMENT" } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          number: true,
          status: true,
          total: true,
          currency: true,
          createdAt: true,
        },
      },
      reviews: {
        orderBy: { createdAt: "desc" },
        select: { id: true, rating: true, status: true, product: { select: { name: true } } },
      },
    },
  });
  if (!user || user.roleId) return null;
  const spend = user.orders
    .filter((o) => (SPEND_STATUSES as readonly string[]).includes(o.status))
    .reduce((s, o) => s + o.total, 0);
  const subscriber = await prisma.newsletterSubscriber.findUnique({
    where: { email: user.email },
    select: { status: true },
  });
  return { ...user, spend, newsletter: subscriber?.status ?? null };
}

export async function updateCustomer(
  prisma: PrismaClient,
  input: {
    id: string;
    name: string;
    phone: string | null;
    status: "ACTIVE" | "DEACTIVATED";
    actorId: string;
  },
) {
  const before = await prisma.user.findUnique({ where: { id: input.id } });
  if (!before || before.roleId) throw new UserError("This customer no longer exists.");
  const after = await prisma.user.update({
    where: { id: input.id },
    data: { name: input.name, phone: input.phone, status: input.status },
  });
  // Deactivating signs the customer out everywhere.
  if (input.status === "DEACTIVATED")
    await prisma.session.deleteMany({ where: { userId: input.id } });
  await audit(prisma, {
    actorId: input.actorId,
    action: "customer.update",
    targetType: "User",
    targetId: input.id,
    before: { name: before.name, phone: before.phone, status: before.status },
    after: { name: after.name, phone: after.phone, status: after.status },
  });
}
