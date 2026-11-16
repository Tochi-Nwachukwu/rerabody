"use client";

import { useState } from "react";

import { FormMessage } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { unsubscribeAction } from "@/server/actions/newsletter";

export function UnsubscribeButton({ s, sig }: { s: string; sig: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = useState("");
  if (state === "done")
    return (
      <FormMessage tone="success">
        You have been unsubscribed. You will not receive marketing emails from us.
      </FormMessage>
    );
  return (
    <div className="flex flex-col items-center gap-3">
      {state === "error" ? <FormMessage>{error}</FormMessage> : null}
      <Button
        size="lg"
        disabled={state === "busy"}
        onClick={async () => {
          setState("busy");
          const res = await unsubscribeAction({ s, sig });
          if (res.ok) setState("done");
          else {
            setError(res.error);
            setState("error");
          }
        }}
      >
        {state === "busy" ? "Unsubscribing…" : "Unsubscribe"}
      </Button>
    </div>
  );
}
