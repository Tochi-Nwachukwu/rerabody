import type { Metadata } from "next";

import { CollectionEditor } from "@/components/admin/catalogue/collection-editor";
import { PageHeader } from "@/components/admin/page-header";
import { requirePagePermission } from "@/server/auth/session";

import { loadProductOptions } from "../products";

export const metadata: Metadata = { title: "Add collection" };

export default async function NewCollectionPage() {
  await requirePagePermission("products.write");
  const products = await loadProductOptions();
  return (
    <>
      <PageHeader title="Add collection" />
      <CollectionEditor
        initial={{ name: "", slug: "", description: "", banner: null, productIds: [] }}
        products={products}
      />
    </>
  );
}
