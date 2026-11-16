"use client";

import { ImagePlus, Star, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { MediaPicker } from "@/components/admin/media/media-picker";
import { MoneyInput } from "@/components/admin/money-input";
import { RichTextEditor, type RichTextValue } from "@/components/admin/rich-text-editor";
import { SortableList } from "@/components/admin/sortable-list";
import { FormMessage, TextField } from "@/components/form/text-field";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { type ProductInput, productSchema } from "@/lib/schemas/catalogue";
import { slugify } from "@/lib/slug";
import type { MediaItem } from "@/lib/upload-client";
import { cn } from "@/lib/utils";
import {
  type DraftVariant,
  type OptionInput,
  reconcileVariants,
  variantLabel,
} from "@/lib/variants";
import { deleteProductAction, saveProductAction } from "@/server/actions/catalogue";

export type EditorImage = { mediaId: string; url: string; alt: string | null; isCover: boolean };
export type EditorState = Omit<
  ProductInput,
  "images" | "variants" | "description" | "specs" | "sizeGuide"
> & {
  images: EditorImage[];
  variants: DraftVariant[];
  description: RichTextValue;
  specs: RichTextValue;
  sizeGuide: RichTextValue;
};

type Option = { id: string; name: string; valuesText: string };

const toOptions = (opts: OptionInput[]): Option[] =>
  opts.map((o, i) => ({ id: `opt-${i}-${o.name}`, name: o.name, valuesText: o.values.join(", ") }));
const fromOptions = (opts: Option[]): OptionInput[] =>
  opts
    .map((o) => ({
      name: o.name.trim(),
      values: [
        ...new Set(
          o.valuesText
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean),
        ),
      ],
    }))
    .filter((o) => o.name);

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card flex flex-col gap-4 rounded-xl border p-4 sm:p-5">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

// A5 product editor
export function ProductEditor({
  initial,
  categories,
  collections,
  currency,
  canDelete,
}: {
  initial: EditorState;
  categories: { id: string; name: string }[];
  collections: { id: string; name: string }[];
  currency: string;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<EditorState>(initial);
  const [options, setOptions] = useState<Option[]>(toOptions(initial.options));
  const [slugTouched, setSlugTouched] = useState(!!initial.id);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const isNew = !initial.id;

  const set = <K extends keyof EditorState>(key: K, value: EditorState[K]) =>
    setState((s) => ({ ...s, [key]: value }));

  function applyOptions(next: Option[]) {
    setOptions(next);
    const parsed = fromOptions(next);
    setState((s) => ({
      ...s,
      options: parsed,
      variants: reconcileVariants(parsed, s.variants, {
        skuBase: s.slug || s.name,
        price: s.variants[0]?.price ?? 0,
      }),
    }));
  }

  function updateVariant(index: number, patch: Partial<DraftVariant>) {
    setState((s) => ({
      ...s,
      variants: s.variants.map((v, i) => (i === index ? { ...v, ...patch } : v)),
    }));
  }

  const imageChoices = useMemo(
    () => state.images.map((i, n) => ({ id: i.mediaId, label: `Image ${n + 1}` })),
    [state.images],
  );

  function save(status?: EditorState["status"]) {
    const payload = {
      ...state,
      status: status ?? state.status,
      description: state.description as ProductInput["description"],
      specs: state.specs as ProductInput["specs"],
      sizeGuide: state.sizeGuide as ProductInput["sizeGuide"],
      images: state.images.map((i) => ({ mediaId: i.mediaId, isCover: i.isCover })),
      variants: state.variants.map((v) => ({
        id: v.id,
        optionValues: v.optionValues,
        sku: v.sku,
        price: v.price,
        compareAtPrice: v.compareAtPrice,
        initialStock: v.id ? 0 : v.initialStock,
        lowStockThreshold: v.lowStockThreshold,
        imageId: v.imageId,
        isActive: v.isActive,
      })),
    };
    const check = productSchema.safeParse(payload);
    if (!check.success) {
      setErrors(
        check.error.issues.map(
          (i) => `${i.path.length ? `${i.path.join(" ")}: ` : ""}${i.message}`,
        ),
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setErrors([]);
    start(async () => {
      const res = await saveProductAction(payload);
      if (!res.ok) {
        setErrors([res.error]);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      toast.success(status === "PUBLISHED" ? "Product published" : "Product saved");
      if (status) set("status", status);
      if (isNew) router.replace(`/admin/products/${res.data.id}`);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6 pb-24">
      {errors.length ? (
        <FormMessage>
          <p className="font-medium">Please fix the following:</p>
          <ul className="ml-4 list-disc">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </FormMessage>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Section title="Basics">
            <TextField
              id="name"
              label="Name"
              value={state.name}
              onChange={(e) => {
                const name = e.target.value;
                setState((s) => ({ ...s, name, slug: slugTouched ? s.slug : slugify(name) }));
              }}
            />
            <RichTextEditor
              id="description"
              label="Description"
              value={state.description}
              onChange={(v) => set("description", v)}
              minHeight="10rem"
            />
          </Section>

          <Section
            title="Images"
            description="Drag to reorder. The cover image is shown first in the shop."
          >
            {state.images.length ? (
              <SortableList
                layout="grid"
                className="grid grid-cols-2 gap-3 sm:grid-cols-3"
                items={state.images.map((i) => ({ ...i, id: i.mediaId }))}
                itemLabel={(i) => i.alt || "image"}
                onReorder={(items) => set("images", items)}
                renderItem={(img) => (
                  <div className="flex flex-col gap-1.5">
                    <div
                      className={cn(
                        "bg-muted relative aspect-square overflow-hidden rounded-md border",
                        img.isCover && "ring-primary ring-2",
                      )}
                    >
                      <Image
                        src={img.url}
                        alt={img.alt ?? ""}
                        fill
                        sizes="200px"
                        className="object-cover"
                      />
                      {img.isCover ? (
                        <span className="bg-primary text-primary-foreground absolute top-1 left-1 rounded px-1.5 py-0.5 text-xs">
                          Cover
                        </span>
                      ) : null}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        disabled={img.isCover}
                        onClick={() =>
                          set(
                            "images",
                            state.images.map((x) => ({ ...x, isCover: x.mediaId === img.mediaId })),
                          )
                        }
                      >
                        <Star /> Cover
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        aria-label="Remove image"
                        onClick={() => {
                          const rest = state.images.filter((x) => x.mediaId !== img.mediaId);
                          if (img.isCover && rest[0]) rest[0] = { ...rest[0], isCover: true };
                          set("images", rest);
                          setState((s) => ({
                            ...s,
                            variants: s.variants.map((v) =>
                              v.imageId === img.mediaId ? { ...v, imageId: null } : v,
                            ),
                          }));
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                )}
              />
            ) : (
              <p className="text-muted-foreground text-sm">No images yet.</p>
            )}
            <MediaPicker
              multiple
              onSelect={(items: MediaItem[]) => {
                const existing = new Set(state.images.map((i) => i.mediaId));
                const added = items
                  .filter((i) => !existing.has(i.id))
                  .map((i) => ({ mediaId: i.id, url: i.url, alt: i.alt, isCover: false }));
                const all = [...state.images, ...added];
                if (all.length && !all.some((i) => i.isCover))
                  all[0] = { ...all[0], isCover: true };
                set("images", all);
              }}
              trigger={
                <Button type="button" variant="outline" className="self-start">
                  <ImagePlus /> Add images
                </Button>
              }
            />
          </Section>

          <Section
            title="Options"
            description="For example Size with values S, M, L. Variants are generated from every combination."
          >
            {options.map((o, i) => (
              <div
                key={o.id}
                className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end"
              >
                <TextField
                  id={`opt-name-${i}`}
                  label="Option name"
                  value={o.name}
                  onChange={(e) =>
                    applyOptions(
                      options.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                    )
                  }
                />
                <TextField
                  id={`opt-values-${i}`}
                  label="Values"
                  description="Separate values with commas."
                  value={o.valuesText}
                  onChange={(e) =>
                    applyOptions(
                      options.map((x, j) => (j === i ? { ...x, valuesText: e.target.value } : x)),
                    )
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => applyOptions(options.filter((_, j) => j !== i))}
                >
                  Remove
                </Button>
              </div>
            ))}
            {options.length < 3 ? (
              <Button
                type="button"
                variant="outline"
                className="self-start"
                onClick={() =>
                  applyOptions([
                    ...options,
                    {
                      id: `opt-${Date.now()}`,
                      name: options.length === 0 ? "Size" : options.length === 1 ? "Colour" : "",
                      valuesText: "",
                    },
                  ])
                }
              >
                Add option
              </Button>
            ) : null}
          </Section>

          <Section
            title="Variants"
            description={`Prices in ${currency}. Stock for saved variants changes in Inventory, so every change is recorded.`}
          >
            <div className="flex flex-col gap-3">
              {state.variants.map((v, i) => (
                <fieldset
                  key={v.id ?? JSON.stringify(v.optionValues)}
                  className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-3"
                >
                  <legend className="px-1 text-sm font-medium">
                    {variantLabel(v.optionValues)}
                  </legend>
                  <TextField
                    id={`sku-${i}`}
                    label="SKU"
                    value={v.sku}
                    onChange={(e) => updateVariant(i, { sku: e.target.value.toUpperCase() })}
                  />
                  <Field>
                    <FieldLabel htmlFor={`price-${i}`}>Price</FieldLabel>
                    <MoneyInput
                      id={`price-${i}`}
                      currency={currency}
                      value={v.price}
                      onChange={(p) => updateVariant(i, { price: p ?? 0 })}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`compare-${i}`}>Compare-at price</FieldLabel>
                    <MoneyInput
                      id={`compare-${i}`}
                      nullable
                      currency={currency}
                      value={v.compareAtPrice}
                      onChange={(p) => updateVariant(i, { compareAtPrice: p })}
                      placeholder="Optional"
                    />
                  </Field>
                  {v.id ? (
                    <div className="flex flex-col gap-1.5 text-sm">
                      <span className="font-medium">Stock</span>
                      <span>
                        {v.stock ?? 0}{" "}
                        <Link
                          href={`/admin/inventory?q=${encodeURIComponent(v.sku)}`}
                          className="text-muted-foreground underline underline-offset-4"
                        >
                          Adjust
                        </Link>
                      </span>
                    </div>
                  ) : (
                    <TextField
                      id={`stock-${i}`}
                      label="Opening stock"
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={v.initialStock}
                      onChange={(e) =>
                        updateVariant(i, {
                          initialStock: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                        })
                      }
                    />
                  )}
                  <TextField
                    id={`low-${i}`}
                    label="Low stock alert at"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={v.lowStockThreshold}
                    onChange={(e) =>
                      updateVariant(i, {
                        lowStockThreshold: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                      })
                    }
                  />
                  <Field>
                    <FieldLabel htmlFor={`img-${i}`}>Variant image</FieldLabel>
                    <select
                      id={`img-${i}`}
                      className="bg-background h-8 rounded-lg border px-2 text-sm"
                      value={v.imageId ?? ""}
                      onChange={(e) => updateVariant(i, { imageId: e.target.value || null })}
                    >
                      <option value="">Use product images</option>
                      {imageChoices.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field orientation="horizontal">
                    <Switch
                      id={`active-${i}`}
                      checked={v.isActive}
                      onCheckedChange={(c) => updateVariant(i, { isActive: c })}
                    />
                    <FieldLabel htmlFor={`active-${i}`}>Available for sale</FieldLabel>
                  </Field>
                </fieldset>
              ))}
            </div>
          </Section>

          <Section title="Details">
            <RichTextEditor
              id="specs"
              label="Specifications or ingredients"
              value={state.specs}
              onChange={(v) => set("specs", v)}
            />
            <RichTextEditor
              id="sizeGuide"
              label="Size guide"
              value={state.sizeGuide}
              onChange={(v) => set("sizeGuide", v)}
            />
          </Section>

          <Section title="Search engine listing">
            <TextField
              id="slug"
              label="URL slug"
              description={`/products/${state.slug || "…"}`}
              value={state.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set("slug", e.target.value.toLowerCase());
              }}
            />
            <TextField
              id="metaTitle"
              label="Meta title"
              description="Up to 70 characters. Defaults to the product name."
              value={state.metaTitle ?? ""}
              onChange={(e) => set("metaTitle", e.target.value)}
              maxLength={70}
            />
            <TextField
              id="metaDescription"
              label="Meta description"
              description="Up to 170 characters."
              value={state.metaDescription ?? ""}
              onChange={(e) => set("metaDescription", e.target.value)}
              maxLength={170}
            />
          </Section>
        </div>

        <aside className="flex flex-col gap-6">
          <Section title="Status">
            <Field>
              <FieldLabel htmlFor="status">Status</FieldLabel>
              <select
                id="status"
                className="bg-background h-8 rounded-lg border px-2 text-sm"
                value={state.status}
                onChange={(e) => set("status", e.target.value as EditorState["status"])}
              >
                <option value="DRAFT">Draft (hidden)</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived (hidden, history kept)</option>
              </select>
            </Field>
            {initial.id ? (
              <Link
                href={`/products/${initial.slug}${initial.status === "PUBLISHED" ? "" : "?preview=1"}`}
                target="_blank"
                className={buttonVariants({ variant: "outline" })}
              >
                {initial.status === "PUBLISHED" ? "View in store" : "Preview"}
              </Link>
            ) : null}
          </Section>
          <Section title="Organisation">
            <Field>
              <FieldLabel htmlFor="category">Category</FieldLabel>
              <select
                id="category"
                className="bg-background h-8 rounded-lg border px-2 text-sm"
                value={state.categoryId ?? ""}
                onChange={(e) => set("categoryId", e.target.value || null)}
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">Collections</legend>
              {collections.map((c) => (
                <Field key={c.id} orientation="horizontal">
                  <Checkbox
                    id={`col-${c.id}`}
                    checked={state.collectionIds.includes(c.id)}
                    onCheckedChange={(checked) =>
                      set(
                        "collectionIds",
                        checked
                          ? [...state.collectionIds, c.id]
                          : state.collectionIds.filter((x) => x !== c.id),
                      )
                    }
                  />
                  <FieldLabel htmlFor={`col-${c.id}`} className="font-normal">
                    {c.name}
                  </FieldLabel>
                </Field>
              ))}
            </fieldset>
          </Section>
          {canDelete && initial.id ? (
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  if (
                    !window.confirm(
                      "Delete this product permanently? Products with orders can only be archived.",
                    )
                  )
                    return;
                  const res = await deleteProductAction({ id: initial.id! });
                  if (!res.ok) {
                    toast.error(res.error);
                    return;
                  }
                  toast.success("Product deleted");
                  router.replace("/admin/products");
                })
              }
            >
              Delete product
            </Button>
          ) : null}
        </aside>
      </div>

      <div className="bg-background/95 fixed inset-x-0 bottom-0 z-20 border-t px-4 py-3 backdrop-blur lg:pl-64">
        <div className="mx-auto flex max-w-5xl items-center justify-end gap-2">
          <span className="text-muted-foreground mr-auto hidden text-sm sm:inline">
            {isNew ? "New product" : state.name}
          </span>
          <Button type="button" variant="outline" disabled={pending} onClick={() => save()}>
            {pending ? "Saving…" : "Save"}
          </Button>
          {state.status !== "PUBLISHED" ? (
            <Button type="button" disabled={pending} onClick={() => save("PUBLISHED")}>
              Publish
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
