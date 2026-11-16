import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CollectionEditor } from "@/components/admin/catalogue/collection-editor";
import { PageHeader } from "@/components/admin/page-header";
import { requirePagePermission } from "@/server/auth/session";
import { db } from "@/server/db";

import { loadProductOptions } from "../products";

export const metadata: Metadata = { title: "Edit collection" };

export default async function EditCollectionPage({ params }: PageProps<"/admin/collections/[id]">) {
  await requirePagePermission("products.write");
  const { id } = await params;
  const [collection, products] = await Promise.all([
    db.collection.findUnique({
      where: { id },
      include: { bannerImage: true, products: { orderBy: { position: "asc" } } },
    }),
    loadProductOptions(),
  ]);
  if (!collection) notFound();
  return (
    <>
      <PageHeader title={collection.name} />
      <CollectionEditor
        products={products}
        initial={{
          id: collection.id,
          name: collection.name,
          slug: collection.slug,
          description: collection.description ?? "",
          banner: collection.bannerImage
            ? {
                id: collection.bannerImage.id,
                url: collection.bannerImage.url,
                alt: collection.bannerImage.alt,
              }
            : null,
          productIds: collection.products.map((p) => p.productId),
        }}
      />
    </>
  );
}
