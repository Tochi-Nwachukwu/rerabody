"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { FormMessage } from "@/components/form/text-field";
import { Button, buttonVariants } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function VerifyEmailPanel() {
  const params = useSearchParams();
  const email = params.get("email");
  const verified = params.get("verified") === "1" && !params.get("error");
  const failed = !!params.get("error");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function resend() {
    if (!email) return;
    setState("sending");
    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: "/verify-email?verified=1",
    });
    setState(error ? "error" : "sent");
  }

  if (verified) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <FormMessage tone="success">Your email is confirmed. Your account is ready.</FormMessage>
        <Link href="/account" className={buttonVariants({ size: "lg" })}>
          Go to my account
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 text-center">
      {failed ? (
        <FormMessage>
          This link has expired or was already used. Sign in to get a new one.
        </FormMessage>
      ) : (
        <p className="text-sm">
          We sent a link to {email ? <strong>{email}</strong> : "your email address"}. Open it to
          confirm your account. The link works for 24 hours.
        </p>
      )}
      {state === "sent" ? (
        <FormMessage tone="success">A new link is on its way.</FormMessage>
      ) : null}
      {state === "error" ? (
        <FormMessage>We could not send a new link. Please try again shortly.</FormMessage>
      ) : null}
      {email ? (
        <Button variant="outline" size="lg" onClick={resend} disabled={state === "sending"}>
          {state === "sending" ? "Sending…" : "Send the link again"}
        </Button>
      ) : null}
      <Link href="/login" className="text-sm underline underline-offset-4">
        Back to sign in
      </Link>
    </div>
  );
}
