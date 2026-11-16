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
import { loginSchema, safeNext } from "@/lib/schemas/auth";

type Values = z.input<typeof loginSchema>;

export function LoginForm({
  defaultNext,
  forgotHref = "/forgot-password",
}: {
  defaultNext: string;
  forgotHref?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"), defaultNext);
  const [message, setMessage] = useState<{
    tone: "error" | "info" | "success";
    text: string;
  } | null>(
    params.get("reset") === "1"
      ? { tone: "success", text: "Your password has been changed. Please sign in." }
      : null,
  );
  const form = useForm<Values>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: Values) {
    setMessage(null);
    const parsed = loginSchema.parse(values);
    const { error } = await authClient.signIn.email({
      email: parsed.email,
      password: parsed.password,
    });
    if (error) {
      if (error.code === "EMAIL_NOT_VERIFIED") {
        setMessage({
          tone: "info",
          text: "Please confirm your email first. We have sent you a new link.",
        });
      } else if (error.status === 429) {
        setMessage({
          tone: "error",
          text: "Too many attempts. Please wait a minute and try again.",
        });
      } else if (error.status === 403) {
        setMessage({ tone: "error", text: error.message ?? "This account cannot sign in." });
      } else {
        setMessage({ tone: "error", text: "That email and password do not match." });
      }
      return;
    }
    router.push(next);
    router.refresh();
  }

  const { errors, isSubmitting } = form.formState;
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}
      <TextField
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...form.register("email")}
      />
      <TextField
        id="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...form.register("password")}
      />
      <div className="-mt-1 text-right text-sm">
        <Link href={forgotHref} className="underline underline-offset-4">
          Forgot your password?
        </Link>
      </div>
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
