import type { Metadata } from "next";

import { HomepageEditor } from "@/components/admin/content/homepage-editor";
import { PageHeader } from "@/components/admin/page-header";
import { parseSection } from "@/lib/home-sections";
import { requirePagePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { hasUnpublishedChanges, listDraftSections } from "@/server/services/home-sections";

export const metadata: Metadata = { title: "Homepage" };

// A19
export default async function HomepagePage() {
  await requirePagePermission("content.manage");
  const [sections, changed] = await Promise.all([listDraftSections(db), hasUnpublishedChanges(db)]);
  return (
    <>
      <PageHeader
        title="Homepage"
        description="Drag to reorder. Edit, hide, duplicate or delete sections, preview the draft, then publish."
      />
      <HomepageEditor
        key={sections.map((s) => s.id).join()}
        hasChanges={changed}
        sections={sections.map((s) => ({
          id: s.id,
          type: s.type,
          isVisible: s.isVisible,
          data: s.data,
          isNew: s.isNew,
          changed: s.changed,
          valid: parseSection(s.type, s.data).success,
        }))}
      />
    </>
  );
}
