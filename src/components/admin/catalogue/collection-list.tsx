"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { SortableList } from "@/components/admin/sortable-list";
import { buttonVariants } from "@/components/ui/button";
import { reorderCollectionsAction } from "@/server/actions/catalogue";

export function CollectionList({
  initial,
}: {
  initial: { id: string; name: string; slug: string; productCount: number }[];
}) {
  const [rows, setRows] = useState(initial);
  const [, start] = useTransition();
  return (
    <SortableList
      items={rows}
      className="flex flex-col divide-y rounded-xl border"
      itemLabel={(r) => r.name}
      onReorder={(next) => {
        setRows(next);
        start(async () => {
          const res = await reorderCollectionsAction({ ids: next.map((r) => r.id) });
          if (!res.ok) toast.error(res.error);
        });
      }}
      renderItem={(r) => (
        <div className="flex items-center justify-between gap-3 px-3 py-3">
          <div className="min-w-0">
            <p className="font-medium">{r.name}</p>
            <p className="text-muted-foreground truncate text-xs">
              /collections/{r.slug} · {r.productCount} product{r.productCount === 1 ? "" : "s"}
            </p>
          </div>
          <Link
            href={`/admin/collections/${r.id}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Edit
          </Link>
        </div>
      )}
    />
  );
}
