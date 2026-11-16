import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { MediaLibrary } from "@/components/admin/media/media-library";
import { PageHeader } from "@/components/admin/page-header";
import { Pager, firstParam, pageParam } from "@/components/admin/pager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireStaff } from "@/server/auth/session";
import { db } from "@/server/db";
import { listMedia } from "@/server/services/media";

export const metadata: Metadata = { title: "Media" };

// A24 media library
export default async function MediaPage({ searchParams }: PageProps<"/admin/media">) {
  const staff = await requireStaff();
  const canUpload = staff.permissions.has("media.upload");
  const canDelete = staff.permissions.has("media.delete");
  if (!canUpload && !canDelete) redirect("/admin?denied=media.upload");

  const sp = await searchParams;
  const q = firstParam(sp.q)?.trim() || undefined;
  const { items, page, pageCount, total } = await listMedia(db, { q, page: pageParam(sp.page) });

  return (
    <>
      <PageHeader
        title="Media"
        description={`${total} image${total === 1 ? "" : "s"}. Images in use cannot be deleted.`}
      />
      <form className="mb-6 flex max-w-md gap-2" action="/admin/media">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search by alt text"
          aria-label="Search images"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>
      <MediaLibrary
        canUpload={canUpload}
        canDelete={canDelete}
        items={items.map((m) => ({
          id: m.id,
          url: m.url,
          alt: m.alt,
          width: m.width,
          height: m.height,
          bytes: m.bytes,
          mimeType: m.mimeType,
          createdAt: m.createdAt.toISOString(),
        }))}
      />
      <Pager page={page} pageCount={pageCount} params={{ q }} basePath="/admin/media" />
    </>
  );
}
