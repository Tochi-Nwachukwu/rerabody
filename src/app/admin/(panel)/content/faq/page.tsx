import type { Metadata } from "next";

import { FaqManager } from "@/components/admin/content/faq-manager";
import { PageHeader } from "@/components/admin/page-header";
import { requirePagePermission } from "@/server/auth/session";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "FAQ" };

// A22
export default async function FaqAdminPage() {
  await requirePagePermission("content.manage");
  const faqs = await db.faq.findMany({
    orderBy: { position: "asc" },
    select: { id: true, topic: true, question: true, answer: true },
  });
  return (
    <>
      <PageHeader
        title="FAQ"
        description="Questions appear on the FAQ page grouped by topic, in this order. Changes are live as soon as you save."
      />
      <FaqManager initial={faqs} />
    </>
  );
}
