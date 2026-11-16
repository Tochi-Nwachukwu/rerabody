import type { PrismaClient } from "@/generated/prisma/client";
import type { AddressData } from "@/lib/schemas/checkout";
import { UserError } from "@/server/errors";

export function listOrdersForUser(prisma: PrismaClient, userId: string, take?: number) {
  return prisma.order.findMany({
    where: { userId, status: { not: "PENDING_PAYMENT" } },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      number: true,
      status: true,
      total: true,
      currency: true,
      createdAt: true,
      _count: { select: { items: true } },
    },
  });
}

export function getOrderView(prisma: PrismaClient, orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      statusEvents: { orderBy: { createdAt: "asc" }, select: { toStatus: true, createdAt: true } },
      payments: { select: { refundedAmount: true } },
    },
  });
}

export type OrderViewData = NonNullable<Awaited<ReturnType<typeof getOrderView>>>;

export async function saveAddress(
  prisma: PrismaClient,
  userId: string,
  input: AddressData & { id?: string; isDefault: boolean },
) {
  return prisma.$transaction(async (tx) => {
    if (input.id) {
      const existing = await tx.address.findFirst({ where: { id: input.id, userId } });
      if (!existing) throw new UserError("That address no longer exists.");
    }
    const count = await tx.address.count({ where: { userId } });
    const makeDefault = input.isDefault || count === 0;
    if (makeDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    const data = {
      fullName: input.fullName,
      phone: input.phone,
      line1: input.line1,
      line2: input.line2 ?? null,
      city: input.city,
      state: input.state ?? null,
      postalCode: input.postalCode ?? null,
      country: input.country,
      isDefault: makeDefault,
    };
    return input.id
      ? tx.address.update({ where: { id: input.id }, data })
      : tx.address.create({ data: { ...data, userId } });
  });
}

export async function deleteAddress(prisma: PrismaClient, userId: string, id: string) {
  const address = await prisma.address.findFirst({ where: { id, userId } });
  if (!address) throw new UserError("That address no longer exists.");
  await prisma.address.delete({ where: { id } });
  if (address.isDefault) {
    const next = await prisma.address.findFirst({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });
    if (next) await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
  }
}

export async function updateProfile(
  prisma: PrismaClient,
  userId: string,
  input: { name: string; phone: string | null },
) {
  return prisma.user.update({
    where: { id: userId },
    data: { name: input.name, phone: input.phone },
  });
}

/** S24 lookup: order number plus the email it was placed with. */
export async function findOrderByNumberAndEmail(
  prisma: PrismaClient,
  number: string,
  email: string,
) {
  const order = await prisma.order.findUnique({
    where: { number: number.trim().toUpperCase() },
    select: { id: true, email: true, status: true },
  });
  if (
    !order ||
    order.status === "PENDING_PAYMENT" ||
    order.email.toLowerCase() !== email.trim().toLowerCase()
  )
    return null;
  return order.id;
}
