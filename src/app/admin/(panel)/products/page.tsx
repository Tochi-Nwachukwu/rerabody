import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { EmptyState, FilterBar, FilterSelect } from "@/components/admin/filter-bar";
import { PageHeader } from "@/components/admin/page-header";
import { Pager, firstParam, pageParam } from "@/components/admin/pager";
import { StatusBadge } from "@/components/admin/status-badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { env } from "@/env";
import { formatMoney } from "@/lib/money";
import { requirePagePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { listProductsAdmin } from "@/server/services/products";

export const metadata: Metadata = { title: "Products" };

const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

// A4 products list
export default async function ProductsPage({ searchParams }: PageProps<"/admin/products">) {
  const staff = await requirePagePermission("products.read");
  const sp = await searchParams;
  const q = firstParam(sp.q)?.trim() || undefined;
  const statusParam = firstParam(sp.status);
  const status = STATUSES.find((s) => s === statusParam);
  const categoryId = firstParam(sp.category) || undefined;
  const [{ items, total, page, pageCount }, categories] = await Promise.all([
    listProductsAdmin(db, { q, status, categoryId, page: pageParam(sp.page) }),
    db.category.findMany({ orderBy: { position: "asc" }, select: { id: true, name: true } }),
  ]);
  const price = (min: number | null, max: number | null) =>
    min === null
      ? "—"
      : min === max
        ? formatMoney(min, env.STORE_CURRENCY)
        : `${formatMoney(min, env.STORE_CURRENCY)} – ${formatMoney(max!, env.STORE_CURRENCY)}`;

  return (
    <>
      <PageHeader
        title="Products"
        description={`${total} product${total === 1 ? "" : "s"}`}
        actions={
          staff.permissions.has("products.write") ? (
            <Link href="/admin/products/new" className={buttonVariants()}>
              Add product
            </Link>
          ) : null
        }
      />
      <FilterBar action="/admin/products" q={q} placeholder="Search name or SKU">
        <FilterSelect
          name="status"
          label="Status"
          value={status}
          options={STATUSES.map((s) => ({
            value: s,
            label: s.charAt(0) + s.slice(1).toLowerCase(),
          }))}
        />
        <FilterSelect
          name="category"
          label="Category"
          value={categoryId}
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
        />
      </FilterBar>
      {items.length === 0 ? (
        <EmptyState title="No products match">Try a different search or filter.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">
                  <span className="sr-only">Image</span>
                </TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Category</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="hidden text-right md:table-cell">Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="bg-muted relative size-10 overflow-hidden rounded border">
                      {p.cover ? (
                        <Image
                          src={p.cover.url}
                          alt=""
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Link href={`/admin/products/${p.id}`} className="font-medium hover:underline">
                      {p.name}
                    </Link>
                    <p className="text-muted-foreground text-xs">
                      {p.variantCount} variant{p.variantCount === 1 ? "" : "s"}
                    </p>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={p.status} />
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{p.category ?? "—"}</TableCell>
                  <TableCell
                    className={p.stock === 0 ? "text-destructive text-right" : "text-right"}
                  >
                    {p.stock}
                  </TableCell>
                  <TableCell className="hidden text-right md:table-cell">
                    {price(p.minPrice, p.maxPrice)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pager
        page={page}
        pageCount={pageCount}
        params={{ q, status, category: categoryId }}
        basePath="/admin/products"
      />
    </>
  );
}
