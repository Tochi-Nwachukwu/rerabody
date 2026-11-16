import type { Metadata } from "next";
import { Suspense } from "react";

import { AccountNav } from "@/components/store/account/account-nav";

export const metadata: Metadata = {
  title: { default: "My account", template: "%s | My account" },
  robots: { index: false },
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6">
      <h1 className="font-heading text-4xl">My account</h1>
      <Suspense fallback={<div className="h-10 border-b" />}>
        <AccountNav />
      </Suspense>
      {children}
    </div>
  );
}
