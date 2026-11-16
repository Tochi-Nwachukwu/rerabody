import type { Metadata } from "next";
import Link from "next/link";

import { InventoryRowActions } from "@/components/admin/catalogue/inventory-row-actions";
import { EmptyState, FilterBar, FilterSelect } from "@/components/admin/filter-bar";
import { PageHeader } from "@/components/admin/page-header";
import { Pager, firstParam, pageParam } from "@/components/admin/pager";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { variantLabel } from "@/lib/variants";
import { requirePagePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { type InventoryFilter, listInventory } from "@/server/services/inventory";

export const metadata: Metadata = { title: "Inventory" };

// A8 inventory
export default async function InventoryPage({ searchParams }: PageProps<"/admin/inventory">) {
  const staff = await requirePagePermission("inventory.read");
  const sp = await searchParams;
  const q = firstParam(sp.q)?.trim() || undefined;
  const filterParam = firstParam(sp.stock);
  const filter: InventoryFilter =
    filterParam === "low" || filterParam === "out" ? filterParam : "all";
  const categoryId = firstParam(sp.category) || undefined;
  const [{ items, total, page, pageCount }, categories] = await Promise.all([
    listInventory(db, { q, filter, categoryId, page: pageParam(sp.page) }),
    db.category.findMany({ orderBy: { position: "asc" }, select: { id: true, name: true } }),
  ]);
  const canAdjust = staff.permissions.has("inventory.adjust");

  return (
    <>
      <PageHeader
        title="Inventory"
        description={`${total} variant${total === 1 ? "" : "s"}. Every change is recorded with a reason.`}
      />
      <FilterBar action="/admin/inventory" q={q} placeholder="Search SKU or product">
        <FilterSelect
          name="stock"
          label="Stock"
          value={filter === "all" ? undefined : filter}
          options={[
            { value: "low", label: "Low stock" },
            { value: "out", label: "Out of stock" },
          ]}
        />
        <FilterSelect
          name="category"
          label="Category"
          value={categoryId}
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
        />
      </FilterBar>
      {items.length === 0 ? (
        <EmptyState title="No variants match" />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Variant</TableHead>
                <TableHead className="hidden sm:table-cell">SKU</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="hidden text-right md:table-cell">Alert at</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((v) => {
                const label = `${v.product.name} · ${variantLabel(v.optionValues as Record<string, string>)}`;
                const low = v.stock <= v.lowStockThreshold;
                return (
                  <TableRow key={v.id}>
                    <TableCell>
                      <Link
                        href={`/admin/products/${v.product.id}`}
                        className="font-medium hover:underline"
                      >
                        {v.product.name}
                      </Link>
                      <p className="text-muted-foreground text-xs">
                        {variantLabel(v.optionValues as Record<string, string>)}
                        {!v.isActive ? " · not for sale" : ""}
                      </p>
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs sm:table-cell">
                      {v.sku}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-center gap-1.5">
                        {v.stock === 0 ? (
                          <Badge variant="destructive">Out</Badge>
                        ) : low ? (
                          <Badge variant="outline">Low</Badge>
                        ) : null}
                        <span className="font-medium tabular-nums">{v.stock}</span>
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">
                      {v.lowStockThreshold}
                    </TableCell>
                    <TableCell>
                      <InventoryRowActions
                        variantId={v.id}
                        label={label}
                        stock={v.stock}
                        canAdjust={canAdjust}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <Pager
        page={page}
        pageCount={pageCount}
        params={{ q, stock: filter === "all" ? undefined : filter, category: categoryId }}
        basePath="/admin/inventory"
      />
    </>
  );
}
