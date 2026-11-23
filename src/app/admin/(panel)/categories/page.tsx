import type { Metadata } from "next";

import { CategoryManager } from "@/components/admin/catalogue/category-manager";
import { PageHeader } from "@/components/admin/page-header";
import { requirePagePermission } from "@/server/auth/session";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Categories" };

// A6
export default async function CategoriesPage() {
  await requirePagePermission("products.write");
  const rows = await db.category.findMany({
    orderBy: { position: "asc" },
    include: { image: true, _count: { select: { products: true } } },
  });
  return (
    <>
      <PageHeader
        title="Categories"
        description="Categories power the shop filter. Drag to change their order."
      />
      <CategoryManager
        initial={rows.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
          taxCode: c.taxCode,
          image: c.image ? { id: c.image.id, url: c.image.url, alt: c.image.alt } : null,
          productCount: c._count.products,
        }))}
      />
    </>
  );
}
