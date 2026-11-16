"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { subscribeAction } from "@/server/actions/newsletter";

export function NewsletterForm({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  if (state === "done") {
    return (
      <p role="status" className="text-sm">
        Thank you. Please check your inbox for a welcome email.
      </p>
    );
  }
  return (
    <form
      className={compact ? "flex flex-col gap-2" : "mx-auto flex w-full max-w-md flex-col gap-2"}
      onSubmit={async (e) => {
        e.preventDefault();
        setState("busy");
        const res = await subscribeAction({ email });
        if (res.ok) setState("done");
        else {
          setState("error");
          setMessage(res.error);
        }
      }}
    >
      <label
        htmlFor={compact ? "newsletter-footer" : "newsletter-home"}
        className="text-sm font-medium"
      >
        Get news and offers by email
      </label>
      <div className="flex gap-2">
        <Input
          id={compact ? "newsletter-footer" : "newsletter-home"}
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-background"
        />
        <Button type="submit" disabled={state === "busy"}>
          {state === "busy" ? "Joining…" : "Join"}
        </Button>
      </div>
      {state === "error" ? (
        <p role="alert" className="text-destructive text-sm">
          {message}
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">Unsubscribe any time with one click.</p>
      )}
    </form>
  );
}
