"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addOrderNoteAction } from "@/server/actions/orders";

export function OrderNoteForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await addOrderNoteAction({ orderId, body });
          if (!res.ok) return void toast.error(res.error);
          setBody("");
          router.refresh();
        });
      }}
    >
      <label htmlFor="note" className="sr-only">
        Add an internal note
      </label>
      <Textarea
        id="note"
        placeholder="Add an internal note. Customers never see these."
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <Button
        type="submit"
        variant="outline"
        size="sm"
        className="self-end"
        disabled={pending || !body.trim()}
      >
        Add note
      </Button>
    </form>
  );
}
