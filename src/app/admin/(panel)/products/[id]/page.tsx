import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductEditor } from "@/components/admin/catalogue/product-editor";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { env } from "@/env";
import { requirePagePermission } from "@/server/auth/session";

import { loadProductEditorState, loadTaxonomy } from "../editor-data";

export const metadata: Metadata = { title: "Edit product" };

// A5 (edit)
export default async function EditProductPage({ params }: PageProps<"/admin/products/[id]">) {
  await requirePagePermission("products.write");
  const { id } = await params;
  const [initial, { categories, collections }] = await Promise.all([
    loadProductEditorState(id),
    loadTaxonomy(),
  ]);
  if (!initial) notFound();
  return (
    <>
      <PageHeader title={initial.name} description={<StatusBadge status={initial.status} />} />
      <ProductEditor
        initial={initial}
        categories={categories}
        collections={collections}
        currency={env.STORE_CURRENCY}
        canDelete
      />
    </>
  );
}
