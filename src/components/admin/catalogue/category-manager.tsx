"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { type ImageValue, ImageField } from "@/components/admin/image-field";
import { SortableList } from "@/components/admin/sortable-list";
import { FormMessage, TextAreaField, TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { categorySchema } from "@/lib/schemas/catalogue";
import { slugify } from "@/lib/slug";
import {
  deleteCategoryAction,
  reorderCategoriesAction,
  saveCategoryAction,
} from "@/server/actions/catalogue";

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: ImageValue;
  productCount: number;
};

type Draft = { id?: string; name: string; slug: string; description: string; image: ImageValue };

// A6 categories
export function CategoryManager({ initial }: { initial: CategoryRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    if (!draft) return;
    const payload = {
      id: draft.id,
      name: draft.name,
      slug: draft.slug,
      description: draft.description,
      imageId: draft.image?.id ?? null,
    };
    const check = categorySchema.safeParse(payload);
    if (!check.success) return setError(check.error.issues[0]?.message ?? "Check the form");
    start(async () => {
      const res = await saveCategoryAction(payload);
      if (!res.ok) return setError(res.error);
      toast.success("Category saved");
      setDraft(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Button
        className="self-start"
        onClick={() => {
          setError(null);
          setDraft({ name: "", slug: "", description: "", image: null });
        }}
      >
        Add category
      </Button>
      <SortableList
        items={rows}
        className="flex flex-col divide-y rounded-xl border"
        itemLabel={(r) => r.name}
        onReorder={(next) => {
          setRows(next);
          start(async () => {
            const res = await reorderCategoriesAction({ ids: next.map((r) => r.id) });
            if (!res.ok) toast.error(res.error);
          });
        }}
        renderItem={(r) => (
          <div className="flex items-center justify-between gap-3 px-3 py-3">
            <div className="min-w-0">
              <p className="font-medium">{r.name}</p>
              <p className="text-muted-foreground truncate text-xs">
                /{r.slug} · {r.productCount} product{r.productCount === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setError(null);
                  setDraft({
                    id: r.id,
                    name: r.name,
                    slug: r.slug,
                    description: r.description ?? "",
                    image: r.image,
                  });
                }}
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    if (!window.confirm(`Delete ${r.name}?`)) return;
                    const res = await deleteCategoryAction({ id: r.id });
                    if (!res.ok) return void toast.error(res.error);
                    toast.success("Category deleted");
                    setRows((x) => x.filter((y) => y.id !== r.id));
                  })
                }
              >
                Delete
              </Button>
            </div>
          </div>
        )}
      />
      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit category" : "Add category"}</DialogTitle>
          </DialogHeader>
          {draft ? (
            <div className="flex flex-col gap-4">
              {error ? <FormMessage>{error}</FormMessage> : null}
              <TextField
                id="cat-name"
                label="Name"
                value={draft.name}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    name: e.target.value,
                    slug: draft.id ? draft.slug : slugify(e.target.value),
                  })
                }
              />
              <TextField
                id="cat-slug"
                label="URL slug"
                value={draft.slug}
                onChange={(e) => setDraft({ ...draft, slug: e.target.value.toLowerCase() })}
              />
              <TextAreaField
                id="cat-desc"
                label="Description"
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
              <ImageField
                label="Image"
                value={draft.image}
                onChange={(image) => setDraft({ ...draft, image })}
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
