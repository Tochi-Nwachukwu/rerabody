"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function SignOutButton({
  redirectTo = "/",
  variant = "outline",
  className,
  children = "Sign out",
}: {
  redirectTo?: string;
  variant?: "outline" | "ghost" | "default" | "link";
  className?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant={variant}
      className={className}
      disabled={pending}
      onClick={() =>
        start(async () => {
          await authClient.signOut();
          router.push(redirectTo);
          router.refresh();
        })
      }
    >
      {pending ? "Signing out…" : children}
    </Button>
  );
}
