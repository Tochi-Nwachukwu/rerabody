"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { FormMessage, TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { forgotPasswordSchema } from "@/lib/schemas/auth";

type Values = z.input<typeof forgotPasswordSchema>;

export function ForgotPasswordForm({ redirectTo = "/reset-password" }: { redirectTo?: string }) {
  const [sent, setSent] = useState(false);
  const [limited, setLimited] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: Values) {
    const { email } = forgotPasswordSchema.parse(values);
    const { error } = await authClient.requestPasswordReset({ email, redirectTo });
    // Same message whether or not the account exists (rule 13).
    if (error?.status === 429) {
      setLimited(true);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <FormMessage tone="success">
        If an account exists for that email, we have sent a link to reset your password. It works
        for one hour.
      </FormMessage>
    );
  }

  const { errors, isSubmitting } = form.formState;
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      {limited ? (
        <FormMessage>Too many requests. Please wait a minute and try again.</FormMessage>
      ) : null}
      <TextField
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...form.register("email")}
      />
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
