import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { UserError } from "@/server/errors";

import { audit } from "./audit";

export async function createTicket(
  prisma: PrismaClient,
  input: {
    name: string;
    email: string;
    orderNumber: string | null;
    subject: string;
    message: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw<{ n: bigint }[]>`SELECT nextval('ticket_number_seq') AS n`;
    return tx.supportTicket.create({
      data: {
        number: `T-${row.n}`,
        name: input.name,
        email: input.email.toLowerCase(),
        orderNumber: input.orderNumber?.toUpperCase() ?? null,
        subject: input.subject,
        messages: { create: { authorId: null, body: input.message } },
      },
    });
  });
}

export async function replyToTicket(
  prisma: PrismaClient,
  input: { ticketId: string; body: string; actorId: string; close: boolean },
) {
  return prisma.$transaction(async (tx) => {
    const ticket = await tx.supportTicket.findUnique({ where: { id: input.ticketId } });
    if (!ticket) throw new UserError("This ticket no longer exists.");
    const message = await tx.ticketMessage.create({
      data: { ticketId: ticket.id, authorId: input.actorId, body: input.body },
    });
    if (input.close)
      await tx.supportTicket.update({ where: { id: ticket.id }, data: { status: "CLOSED" } });
    else
      await tx.supportTicket.update({
        where: { id: ticket.id },
        data: { status: "OPEN", updatedAt: new Date() },
      });
    await audit(tx, {
      actorId: input.actorId,
      action: "ticket.reply",
      targetType: "SupportTicket",
      targetId: ticket.id,
      after: { messageId: message.id, close: input.close },
    });
    return { ticket, message };
  });
}

export async function setTicketStatus(
  prisma: PrismaClient,
  input: { ticketId: string; status: "OPEN" | "CLOSED"; actorId: string },
) {
  await prisma.supportTicket.update({
    where: { id: input.ticketId },
    data: { status: input.status },
  });
  await audit(prisma, {
    actorId: input.actorId,
    action: `ticket.${input.status.toLowerCase()}`,
    targetType: "SupportTicket",
    targetId: input.ticketId,
  });
}

export async function listTickets(
  prisma: PrismaClient,
  input: { status?: "OPEN" | "CLOSED"; q?: string; page?: number },
) {
  const pageSize = 25;
  const page = Math.max(1, input.page ?? 1);
  const where: Prisma.SupportTicketWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.q
      ? {
          OR: [
            { number: { contains: input.q, mode: "insensitive" } },
            { email: { contains: input.q, mode: "insensitive" } },
            { subject: { contains: input.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { messages: true } } },
    }),
    prisma.supportTicket.count({ where }),
  ]);
  return { items, total, page, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}
