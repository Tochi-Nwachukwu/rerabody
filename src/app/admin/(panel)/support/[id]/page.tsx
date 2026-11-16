import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { TicketReply } from "@/components/admin/support/ticket-reply";
import { cn } from "@/lib/utils";
import { requirePagePermission } from "@/server/auth/session";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Ticket" };

// A18 ticket
export default async function TicketPage({ params }: PageProps<"/admin/support/[id]">) {
  await requirePagePermission("support.manage");
  const { id } = await params;
  const ticket = await db.supportTicket.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } },
    },
  });
  if (!ticket) notFound();
  const order = ticket.orderNumber
    ? await db.order.findUnique({ where: { number: ticket.orderNumber }, select: { id: true } })
    : null;
  return (
    <>
      <PageHeader
        title={ticket.subject}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={ticket.status} /> {ticket.number} · {ticket.name} ({ticket.email})
            {ticket.orderNumber ? (
              <>
                {" · order "}
                {order ? (
                  <Link href={`/admin/orders/${order.id}`} className="underline underline-offset-4">
                    {ticket.orderNumber}
                  </Link>
                ) : (
                  ticket.orderNumber
                )}
              </>
            ) : null}
          </span>
        }
      />
      <div className="flex max-w-3xl flex-col gap-6">
        <ol className="flex flex-col gap-3">
          {ticket.messages.map((m) => (
            <li
              key={m.id}
              className={cn(
                "rounded-xl border p-4",
                m.authorId ? "bg-secondary/40 ml-6" : "bg-card mr-6",
              )}
            >
              <p className="text-muted-foreground mb-1 text-xs">
                {m.author?.name ?? ticket.name} ·{" "}
                {m.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
              </p>
              <p className="text-sm whitespace-pre-line">{m.body}</p>
            </li>
          ))}
        </ol>
        <TicketReply ticketId={ticket.id} status={ticket.status} />
        <p className="text-muted-foreground text-xs">
          Replies the customer sends by email arrive in the store inbox (
          {`contact email in Settings`}), not here.
        </p>
      </div>
    </>
  );
}
