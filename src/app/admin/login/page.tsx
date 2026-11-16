import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { AdminLoginPanel } from "@/components/auth/admin-login-panel";

export const metadata: Metadata = { title: "Sign in" };

// A1
export default function AdminLoginPage() {
  return (
    <div className="flex flex-1 flex-col items-center px-4 py-16">
      <p className="font-heading mb-8 text-2xl font-semibold tracking-[0.12em] uppercase">
        Rera Body admin
      </p>
      <main id="main" className="w-full max-w-sm">
        <AuthCard title="Staff sign in">
          <Suspense>
            <AdminLoginPanel />
          </Suspense>
        </AuthCard>
      </main>
    </div>
  );
}
