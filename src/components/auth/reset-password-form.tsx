"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { FormMessage, TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { resetPasswordSchema } from "@/lib/schemas/auth";

type Values = z.input<typeof resetPasswordSchema>;

export function ResetPasswordForm({
  loginHref = "/login",
  forgotHref = "/forgot-password",
}: {
  loginHref?: string;
  forgotHref?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const [error, setError] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  if (!token || params.get("error")) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <FormMessage>This reset link has expired or was already used.</FormMessage>
        <Link href={forgotHref} className="text-sm underline underline-offset-4">
          Request a new link
        </Link>
      </div>
    );
  }

  async function onSubmit(values: Values) {
    setError(null);
    const v = resetPasswordSchema.parse(values);
    const { error } = await authClient.resetPassword({ newPassword: v.password, token: token! });
    if (error) {
      setError("This reset link has expired or was already used. Please request a new one.");
      return;
    }
    router.push(`${loginHref}?reset=1`);
  }

  const { errors, isSubmitting } = form.formState;
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      {error ? <FormMessage>{error}</FormMessage> : null}
      <TextField
        id="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        description="At least 8 characters."
        error={errors.password?.message}
        {...form.register("password")}
      />
      <TextField
        id="confirmPassword"
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...form.register("confirmPassword")}
      />
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : "Save new password"}
      </Button>
    </form>
  );
}
