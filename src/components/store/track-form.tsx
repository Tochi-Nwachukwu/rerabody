"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { FormMessage, TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { findOrderAction } from "@/server/actions/account";

export function TrackForm() {
  const router = useRouter();
  const [number, setNumber] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const res = await findOrderAction({ number, email });
        setBusy(false);
        if (!res.ok) return setError(res.error);
        router.push(res.data.url);
      }}
    >
      {error ? <FormMessage>{error}</FormMessage> : null}
      <TextField
        id="t-number"
        label="Order number"
        placeholder="RB-10001"
        value={number}
        onChange={(e) => setNumber(e.target.value)}
      />
      <TextField
        id="t-email"
        label="Email used for the order"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Button type="submit" size="lg" disabled={busy}>
        {busy ? "Looking…" : "Find my order"}
      </Button>
    </form>
  );
}
