"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { fakePayAction } from "@/server/actions/checkout";

export function FakePayButtons({
  session,
  success,
  cancel,
}: {
  session: string;
  success: string;
  cancel: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (outcome: "pay" | "fail" | "expire") => {
    setBusy(true);
    const res = await fakePayAction({ session, outcome, success, cancel });
    if (res && !res.ok) setError(res.error);
    setBusy(false);
  };
  return (
    <div className="flex flex-col gap-2">
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <Button size="lg" disabled={busy} onClick={() => run("pay")}>
        Pay (test)
      </Button>
      <Button variant="outline" disabled={busy} onClick={() => run("fail")}>
        Simulate failed payment
      </Button>
      <Button variant="ghost" disabled={busy} onClick={() => run("expire")}>
        Simulate expired session
      </Button>
    </div>
  );
}
