"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { TextAreaField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { replyToTicketAction, setTicketStatusAction } from "@/server/actions/support";

export function TicketReply({ ticketId, status }: { ticketId: string; status: "OPEN" | "CLOSED" }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const send = (close: boolean) =>
    start(async () => {
      const res = await replyToTicketAction({ ticketId, body, close });
      if (!res.ok) return void toast.error(res.error);
      toast.success(
        res.data.emailed
          ? "Reply emailed to the customer"
          : "Reply saved, but the email could not be sent",
      );
      setBody("");
      router.refresh();
    });
  return (
    <div className="flex flex-col gap-3">
      <TextAreaField
        id="reply"
        label="Reply"
        rows={6}
        description="Sent to the customer by email."
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending || !body.trim()} onClick={() => send(false)}>
          Send reply
        </Button>
        <Button variant="outline" disabled={pending || !body.trim()} onClick={() => send(true)}>
          Send and close
        </Button>
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await setTicketStatusAction({
                ticketId,
                status: status === "OPEN" ? "CLOSED" : "OPEN",
              });
              if (!res.ok) return void toast.error(res.error);
              router.refresh();
            })
          }
        >
          {status === "OPEN" ? "Close ticket" : "Reopen ticket"}
        </Button>
      </div>
    </div>
  );
}
