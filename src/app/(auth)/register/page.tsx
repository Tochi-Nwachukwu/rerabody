import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

// S14
export default function RegisterPage() {
  return (
    <AuthCard
      title="Create an account"
      description="Track orders, save addresses and review what you buy."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="text-foreground font-medium underline underline-offset-4">
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
