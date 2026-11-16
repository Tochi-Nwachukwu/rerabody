import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { requirePagePermission } from "@/server/auth/session";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Pages" };

// A21 pages list
export default async function PagesPage() {
  await requirePagePermission("content.manage");
  const pages = await db.page.findMany({
    orderBy: { title: "asc" },
    select: {
      id: true,
      slug: true,
      title: true,
      publishedAt: true,
      draftBody: true,
      updatedAt: true,
    },
  });
  return (
    <>
      <PageHeader
        title="Pages"
        description="Terms, privacy, shipping and other text pages."
        actions={
          <Link href="/admin/content/pages/new" className={buttonVariants()}>
            New page
          </Link>
        }
      />
      <ul className="flex flex-col divide-y rounded-xl border">
        {pages.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <Link href={`/admin/content/pages/${p.id}`} className="font-medium hover:underline">
                {p.title}
              </Link>
              <p className="text-muted-foreground text-xs">/{p.slug}</p>
            </div>
            <div className="flex gap-1">
              {p.publishedAt ? <Badge>Published</Badge> : <Badge variant="outline">Draft</Badge>}
              {p.publishedAt && p.draftBody ? (
                <Badge variant="secondary">Unpublished changes</Badge>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
