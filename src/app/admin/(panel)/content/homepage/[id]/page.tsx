import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SectionForm } from "@/components/admin/content/section-form";
import { PageHeader } from "@/components/admin/page-header";
import { SECTION_DEFAULTS, SECTION_LABELS } from "@/lib/home-sections";
import { requirePagePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { effective } from "@/server/services/home-sections";

export const metadata: Metadata = { title: "Edit section" };

function mediaIdsIn(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => mediaIdsIn(v, out));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if ((k === "imageId" && typeof v === "string") || false) out.add(v);
      else if (k === "imageIds" && Array.isArray(v))
        v.forEach((x) => typeof x === "string" && out.add(x));
      else mediaIdsIn(v, out);
    }
  }
  return out;
}

// A20
export default async function EditSectionPage({
  params,
}: PageProps<"/admin/content/homepage/[id]">) {
  await requirePagePermission("content.manage");
  const { id } = await params;
  const row = await db.homeSection.findUnique({ where: { id } });
  if (!row || row.isDraftDeleted) notFound();
  const section = effective(row);
  const data = { ...SECTION_DEFAULTS[section.type], ...((section.data as object) ?? {}) };
  const [media, products, collections] = await Promise.all([
    db.media.findMany({
      where: { id: { in: [...mediaIdsIn(data)] } },
      select: { id: true, url: true, alt: true },
    }),
    db.product.findMany({
      where: { status: { not: "ARCHIVED" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.collection.findMany({ orderBy: { position: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <>
      <PageHeader
        title={`Edit ${SECTION_LABELS[section.type].toLowerCase()}`}
        description="Saving updates the draft. The live homepage changes when you publish."
      />
      <SectionForm
        id={row.id}
        type={section.type}
        initial={data}
        media={Object.fromEntries(media.map((m) => [m.id, { url: m.url, alt: m.alt }]))}
        options={{ products, collections }}
      />
    </>
  );
}
