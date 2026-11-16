import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { VerifyEmailPanel } from "@/components/auth/verify-email-panel";

export const metadata: Metadata = { title: "Confirm your email", robots: { index: false } };

// S15
export default function VerifyEmailPage() {
  return (
    <AuthCard title="Check your email">
      <Suspense>
        <VerifyEmailPanel />
      </Suspense>
    </AuthCard>
  );
}
