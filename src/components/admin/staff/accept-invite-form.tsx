"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FormMessage, TextField } from "@/components/form/text-field";
import { Button, buttonVariants } from "@/components/ui/button";
import { acceptInviteAction } from "@/server/actions/staff";

// A2 accept invite
export function AcceptInviteForm({
  inviteId,
  token,
  email,
  roleName,
  hasAccount,
}: {
  inviteId: string;
  token: string;
  email: string;
  roleName: string;
  hasAccount: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");

  if (state === "done") {
    return (
      <div className="flex flex-col gap-4">
        <FormMessage tone="success">
          You are on the team. Sign in with your existing password.
        </FormMessage>
        <Link href="/admin/login" className={buttonVariants()}>
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        if (!hasAccount && password !== confirm) return setError("Passwords do not match.");
        setState("busy");
        const res = await acceptInviteAction({
          inviteId,
          token,
          name: name || email,
          password: hasAccount ? undefined : password,
        });
        if (!res.ok) {
          setError(res.error);
          setState("idle");
          return;
        }
        if (res.data.signedIn) {
          router.push("/admin");
          router.refresh();
        } else setState("done");
      }}
    >
      <p className="text-sm">
        Join as <strong>{roleName}</strong> with {email}.
      </p>
      {error ? <FormMessage>{error}</FormMessage> : null}
      {hasAccount ? (
        <p className="text-muted-foreground text-sm">
          You already have an account with this email. Accepting adds admin access to it.
        </p>
      ) : (
        <>
          <TextField
            id="ai-name"
            label="Your name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <TextField
            id="ai-pw"
            label="Choose a password"
            type="password"
            autoComplete="new-password"
            description="At least 8 characters."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <TextField
            id="ai-pw2"
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </>
      )}
      <Button type="submit" size="lg" disabled={state === "busy"}>
        {state === "busy" ? "Joining…" : "Accept invitation"}
      </Button>
    </form>
  );
}
