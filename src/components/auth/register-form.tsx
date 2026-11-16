"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { FormMessage, TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { registerSchema } from "@/lib/schemas/auth";

type Values = z.input<typeof registerSchema>;

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  async function onSubmit(values: Values) {
    setError(null);
    const v = registerSchema.parse(values);
    const { error } = await authClient.signUp.email({
      name: v.name,
      email: v.email,
      password: v.password,
      callbackURL: "/verify-email?verified=1",
    });
    if (error) {
      setError(
        error.status === 429
          ? "Too many attempts. Please wait a minute and try again."
          : error.code === "USER_ALREADY_EXISTS" ||
              error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
            ? "An account with this email already exists. Try signing in instead."
            : (error.message ?? "We could not create your account. Please try again."),
      );
      return;
    }
    router.push(`/verify-email?email=${encodeURIComponent(v.email)}`);
  }

  const { errors, isSubmitting } = form.formState;
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      {error ? <FormMessage>{error}</FormMessage> : null}
      <TextField
        id="name"
        label="Name"
        autoComplete="name"
        error={errors.name?.message}
        {...form.register("name")}
      />
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
        autoComplete="new-password"
        description="At least 8 characters."
        error={errors.password?.message}
        {...form.register("password")}
      />
      <TextField
        id="confirmPassword"
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...form.register("confirmPassword")}
      />
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
