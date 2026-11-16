"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { type ImageValue, ImageField } from "@/components/admin/image-field";
import { SortableList } from "@/components/admin/sortable-list";
import { StatusBadge } from "@/components/admin/status-badge";
import { FormMessage, TextAreaField, TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { collectionSchema } from "@/lib/schemas/catalogue";
import { slugify } from "@/lib/slug";
import { deleteCollectionAction, saveCollectionAction } from "@/server/actions/catalogue";

type ProductOption = { id: string; name: string; status: string };

// A7 collection editor
export function CollectionEditor({
  initial,
  products,
}: {
  initial: {
    id?: string;
    name: string;
    slug: string;
    description: string;
    banner: ImageValue;
    productIds: string[];
  };
  products: ProductOption[];
}) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const available = products
    .filter(
      (p) =>
        !state.productIds.includes(p.id) && p.name.toLowerCase().includes(filter.toLowerCase()),
    )
    .slice(0, 30);

  function save() {
    const payload = {
      id: state.id,
      name: state.name,
      slug: state.slug,
      description: state.description,
      bannerImageId: state.banner?.id ?? null,
      productIds: state.productIds,
    };
    const check = collectionSchema.safeParse(payload);
    if (!check.success) return setError(check.error.issues[0]?.message ?? "Check the form");
    setError(null);
    start(async () => {
      const res = await saveCollectionAction(payload);
      if (!res.ok) return setError(res.error);
      toast.success("Collection saved");
      if (!state.id) router.replace(`/admin/collections/${res.data.id}`);
      else router.refresh();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-4 rounded-xl border p-4">
        {error ? <FormMessage>{error}</FormMessage> : null}
        <TextField
          id="col-name"
          label="Name"
          value={state.name}
          onChange={(e) =>
            setState({
              ...state,
              name: e.target.value,
              slug: state.id ? state.slug : slugify(e.target.value),
            })
          }
        />
        <TextField
          id="col-slug"
          label="URL slug"
          description={`/collections/${state.slug || "…"}`}
          value={state.slug}
          onChange={(e) => setState({ ...state, slug: e.target.value.toLowerCase() })}
        />
        <TextAreaField
          id="col-desc"
          label="Description"
          value={state.description}
          onChange={(e) => setState({ ...state, description: e.target.value })}
        />
        <ImageField
          label="Banner image"
          value={state.banner}
          onChange={(banner) => setState({ ...state, banner })}
        />
        <div className="flex gap-2">
          <Button onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save collection"}
          </Button>
          {state.id ? (
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  if (!window.confirm("Delete this collection? Products are not deleted.")) return;
                  const res = await deleteCollectionAction({ id: state.id! });
                  if (!res.ok) return void toast.error(res.error);
                  toast.success("Collection deleted");
                  router.replace("/admin/collections");
                })
              }
            >
              Delete
            </Button>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col gap-4 rounded-xl border p-4">
        <h2 className="font-semibold">Products in this collection</h2>
        {state.productIds.length === 0 ? (
          <p className="text-muted-foreground text-sm">No products yet. Add some below.</p>
        ) : null}
        <SortableList
          items={state.productIds.map((id) => ({ id }))}
          className="flex flex-col gap-1"
          itemLabel={(i) => byId.get(i.id)?.name ?? "product"}
          onReorder={(items) => setState({ ...state, productIds: items.map((i) => i.id) })}
          renderItem={(i) => (
            <div className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm">
              <span className="truncate">{byId.get(i.id)?.name ?? "Unknown product"}</span>
              <span className="flex items-center gap-1">
                {byId.get(i.id) ? <StatusBadge status={byId.get(i.id)!.status} /> : null}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Remove from collection"
                  onClick={() =>
                    setState({ ...state, productIds: state.productIds.filter((x) => x !== i.id) })
                  }
                >
                  <X />
                </Button>
              </span>
            </div>
          )}
        />
        <div className="flex flex-col gap-2 border-t pt-4">
          <Input
            placeholder="Find products to add"
            aria-label="Find products to add"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
            {available.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{p.name}</span>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => setState({ ...state, productIds: [...state.productIds, p.id] })}
                >
                  Add
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
