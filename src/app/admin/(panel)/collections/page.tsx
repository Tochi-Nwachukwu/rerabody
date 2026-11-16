import type { Metadata } from "next";
import Link from "next/link";

import { CollectionList } from "@/components/admin/catalogue/collection-list";
import { PageHeader } from "@/components/admin/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requirePagePermission } from "@/server/auth/session";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Collections" };

// A7
export default async function CollectionsPage() {
  await requirePagePermission("products.write");
  const rows = await db.collection.findMany({
    orderBy: { position: "asc" },
    include: { _count: { select: { products: true } } },
  });
  return (
    <>
      <PageHeader
        title="Collections"
        description="Collections group products for the menu and homepage banners. Drag to change their order."
        actions={
          <Link href="/admin/collections/new" className={buttonVariants()}>
            Add collection
          </Link>
        }
      />
      <CollectionList
        initial={rows.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          productCount: c._count.products,
        }))}
      />
    </>
  );
}
