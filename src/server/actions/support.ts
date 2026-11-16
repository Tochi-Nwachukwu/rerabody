"use server";

import { z } from "zod";

import { contactSchema } from "@/lib/schemas/contact";
import { absoluteUrl } from "@/lib/site";
import { db } from "@/server/db";
import { sendEmail } from "@/server/email";
import { getSiteSettings } from "@/server/queries/settings";
import { createTicket, replyToTicket, setTicketStatus } from "@/server/services/support";

import { adminAction, publicAction } from "./safe-action";

/** S28 contact form: opens a ticket and emails the customer and the admin. */
export const submitContactAction = publicAction(contactSchema, async (input) => {
  const ticket = await createTicket(db, input);
  const settings = await getSiteSettings();
  const props = {
    name: input.name,
    number: ticket.number,
    subject: input.subject,
    message: input.message,
  };
  await sendEmail({
    template: "ticket-received",
    to: input.email,
    dedupeKey: `ticket:${ticket.id}`,
    props: { ...props, forAdmin: false, adminUrl: null },
    replyTo: settings.store.contactEmail || undefined,
  });
  const admin = settings.notifications.adminAlertEmail;
  if (admin) {
    await sendEmail({
      template: "ticket-received",
      to: admin,
      dedupeKey: `ticket:${ticket.id}:admin`,
      props: { ...props, forAdmin: true, adminUrl: absoluteUrl(`/admin/support/${ticket.id}`) },
      replyTo: input.email,
    });
  }
  return { number: ticket.number };
});

/** A18 reply: saved on the ticket and emailed to the customer (dedupe `ticket-msg:{messageId}`). */
export const replyToTicketAction = adminAction(
  "support.manage",
  z.object({
    ticketId: z.string(),
    body: z.string().trim().min(1, "Write a reply").max(5000),
    close: z.boolean(),
  }),
  async (input, staff) => {
    const { ticket, message } = await replyToTicket(db, { ...input, actorId: staff.userId });
    const settings = await getSiteSettings();
    const res = await sendEmail({
      template: "ticket-reply",
      to: ticket.email,
      dedupeKey: `ticket-msg:${message.id}`,
      props: { name: ticket.name.split(" ")[0], number: ticket.number, body: input.body },
      replyTo: settings.store.contactEmail || undefined,
    });
    return { emailed: res.status === "sent" };
  },
);

export const setTicketStatusAction = adminAction(
  "support.manage",
  z.object({ ticketId: z.string(), status: z.enum(["OPEN", "CLOSED"]) }),
  async (input, staff) => setTicketStatus(db, { ...input, actorId: staff.userId }),
);
