import type { Metadata } from "next";

import { ProductEditor } from "@/components/admin/catalogue/product-editor";
import { PageHeader } from "@/components/admin/page-header";
import { env } from "@/env";
import { requirePagePermission } from "@/server/auth/session";

import { emptyProduct, loadTaxonomy } from "../editor-data";

export const metadata: Metadata = { title: "Add product" };

// A5 (new)
export default async function NewProductPage() {
  await requirePagePermission("products.write");
  const { categories, collections } = await loadTaxonomy();
  return (
    <>
      <PageHeader title="Add product" />
      <ProductEditor
        initial={emptyProduct}
        categories={categories}
        collections={collections}
        currency={env.STORE_CURRENCY}
        canDelete={false}
      />
    </>
  );
}
