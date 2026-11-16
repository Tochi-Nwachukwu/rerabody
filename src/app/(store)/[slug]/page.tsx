import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { RichText } from "@/components/rich-text";
import { PageTitle } from "@/components/store/page-title";
import { Skeleton } from "@/components/ui/skeleton";
import { getStaff } from "@/server/auth/session";
import { db } from "@/server/db";
import { getPublishedPage } from "@/server/queries/content";

export async function generateMetadata({ params }: PageProps<"/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublishedPage(slug);
  if (!page) return { title: "Page not found", robots: { index: false } };
  return {
    title: page.metaTitle || page.title,
    description: page.metaDescription ?? undefined,
    alternates: { canonical: `/${page.slug}` },
  };
}

// S27 policy and content pages (terms, privacy, shipping and returns, and any page the owner adds)
export default function ContentPage({ params, searchParams }: PageProps<"/[slug]">) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-16 h-96 max-w-3xl" />}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ params, searchParams }: PageProps<"/[slug]">) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  let page: { title: string; body: unknown; updatedAt: string } | null =
    await getPublishedPage(slug);
  let preview = false;
  if (sp.preview === "1") {
    const staff = await getStaff();
    if (staff?.permissions.has("content.manage")) {
      const draft = await db.page.findUnique({ where: { slug } });
      if (draft) {
        page = {
          title: draft.title,
          body: draft.draftBody ?? draft.body,
          updatedAt: draft.updatedAt.toISOString(),
        };
        preview = true;
      }
    }
  }
  if (!page) notFound();
  return (
    <article>
      {preview ? (
        <p role="status" className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-950">
          Draft preview
        </p>
      ) : null}
      <PageTitle title={page.title}>
        <p className="text-sm">
          Last updated {new Date(page.updatedAt).toLocaleDateString("en-GB", { dateStyle: "long" })}
        </p>
      </PageTitle>
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <RichText value={page.body} />
      </div>
    </article>
  );
}
