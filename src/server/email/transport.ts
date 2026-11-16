import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { Resend } from "resend";

export type OutgoingEmail = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  headers?: Record<string, string>;
};

export interface EmailTransport {
  send(email: OutgoingEmail): Promise<{ id: string }>;
}

export function createResendTransport(apiKey: string): EmailTransport {
  const resend = new Resend(apiKey);
  return {
    async send(email) {
      const { data, error } = await resend.emails.send({
        from: email.from,
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        replyTo: email.replyTo,
        headers: email.headers,
      });
      if (error || !data) throw new Error(error?.message ?? "Resend returned no data");
      return { id: data.id };
    },
  };
}

export const OUTBOX_PATH = path.join(process.cwd(), ".emails", "outbox.jsonl");

/** Writes each email as one JSON line. Used for local work and end-to-end tests. */
export function createLogTransport(file = OUTBOX_PATH): EmailTransport {
  return {
    async send(email) {
      const id = `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await mkdir(path.dirname(file), { recursive: true });
      await appendFile(
        file,
        JSON.stringify({ id, sentAt: new Date().toISOString(), ...email }) + "\n",
      );
      return { id };
    },
  };
}

/** Collects emails in memory. Used by unit tests. */
export function createMemoryTransport() {
  const sent: (OutgoingEmail & { id: string })[] = [];
  let failNext = false;
  const transport: EmailTransport & { sent: typeof sent; failNextSend(): void } = {
    sent,
    failNextSend() {
      failNext = true;
    },
    async send(email) {
      if (failNext) {
        failNext = false;
        throw new Error("Simulated transport failure");
      }
      const id = `mem_${sent.length + 1}`;
      sent.push({ id, ...email });
      return { id };
    },
  };
  return transport;
}
