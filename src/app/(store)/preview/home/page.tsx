import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { HomeSections } from "@/components/store/home/sections";
import { env } from "@/env";
import { getStaff } from "@/server/auth/session";
import { db } from "@/server/db";
import { loadDraftSections } from "@/server/services/home-sections";

export const metadata: Metadata = {
  title: "Homepage preview",
  robots: { index: false, follow: false },
};

/** Draft homepage for staff with content.manage. Everyone else gets a 404, so drafts never leak. */
export default function HomePreviewPage() {
  return (
    <Suspense>
      <Preview />
    </Suspense>
  );
}

async function Preview() {
  const staff = await getStaff();
  if (!staff?.permissions.has("content.manage")) notFound();
  const sections = await loadDraftSections(db);
  return (
    <>
      <p
        role="status"
        className="sticky top-16 z-30 bg-amber-100 px-4 py-2 text-center text-sm text-amber-950"
      >
        Draft preview. Customers see the published homepage until you publish.
      </p>
      <HomeSections sections={sections} currency={env.STORE_CURRENCY} />
    </>
  );
}
