import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageEditor } from "@/components/admin/content/page-editor";
import { PageHeader } from "@/components/admin/page-header";
import type { RichTextValue } from "@/components/admin/rich-text-editor";
import { requirePagePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { SYSTEM_PAGES } from "@/server/services/content";

export const metadata: Metadata = { title: "Edit page" };

// A21 page editor ("new" creates a page)
export default async function EditPage({ params }: PageProps<"/admin/content/pages/[id]">) {
  await requirePagePermission("content.manage");
  const { id } = await params;
  if (id === "new") {
    return (
      <>
        <PageHeader title="New page" />
        <PageEditor
          initial={{ slug: "", title: "", draftBody: null, metaTitle: "", metaDescription: "" }}
          published={false}
          hasDraft={false}
          system={false}
        />
      </>
    );
  }
  const page = await db.page.findUnique({ where: { id } });
  if (!page) notFound();
  return (
    <>
      <PageHeader title={page.title} />
      <PageEditor
        initial={{
          id: page.id,
          slug: page.slug,
          title: page.title,
          draftBody: (page.draftBody ?? page.body) as RichTextValue,
          metaTitle: page.metaTitle ?? "",
          metaDescription: page.metaDescription ?? "",
        }}
        published={!!page.publishedAt}
        hasDraft={page.draftBody !== null}
        system={SYSTEM_PAGES.has(page.slug)}
      />
    </>
  );
}
