"use client";

import { useSearchParams } from "next/navigation";

import { FormMessage } from "@/components/form/text-field";

import { LoginForm } from "./login-form";
import { SignOutButton } from "./sign-out-button";

export function AdminLoginPanel() {
  const params = useSearchParams();
  if (params.get("error") === "no-access") {
    return (
      <div className="flex flex-col gap-4">
        <FormMessage>
          This account does not have access to the admin. Sign out and use a staff account.
        </FormMessage>
        <SignOutButton redirectTo="/admin/login" />
      </div>
    );
  }
  return <LoginForm defaultNext="/admin" forgotHref="/forgot-password" />;
}
