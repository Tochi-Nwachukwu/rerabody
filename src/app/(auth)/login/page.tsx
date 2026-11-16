import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

// S13
export default function LoginPage() {
  return (
    <AuthCard
      title="Sign in"
      description="Welcome back. Sign in to see your orders and saved addresses."
      footer={
        <>
          New here?{" "}
          <Link
            href="/register"
            className="text-foreground font-medium underline underline-offset-4"
          >
            Create an account
          </Link>
        </>
      }
    >
      <Suspense>
        <LoginForm defaultNext="/account" />
      </Suspense>
    </AuthCard>
  );
}
