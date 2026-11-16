"use client";

import { ImagePlus, Plus, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ImageField } from "@/components/admin/image-field";
import { MediaPicker } from "@/components/admin/media/media-picker";
import { SortableList } from "@/components/admin/sortable-list";
import { FormMessage, TextAreaField, TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { Field as UiField, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import {
  type Field,
  SECTION_FIELDS,
  SECTION_LABELS,
  type SectionType,
  parseSection,
} from "@/lib/home-sections";
import type { MediaItem } from "@/lib/upload-client";
import { saveSectionDraftAction } from "@/server/actions/home";

type Media = Record<string, { url: string; alt: string | null }>;
type Options = {
  products: { id: string; name: string }[];
  collections: { id: string; name: string }[];
};
type Obj = Record<string, unknown>;

function FieldInput({
  field,
  value,
  onChange,
  media,
  setMedia,
  options,
  path,
}: {
  field: Field;
  value: unknown;
  onChange: (v: unknown) => void;
  media: Media;
  setMedia: (m: Media) => void;
  options: Options;
  path: string;
}) {
  const id = `f-${path}`;
  switch (field.kind) {
    case "text":
    case "href":
      return (
        <TextField
          id={id}
          label={field.label}
          value={String(value ?? "")}
          placeholder={field.kind === "href" ? "/shop" : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "textarea":
      return (
        <TextAreaField
          id={id}
          label={field.label}
          description={field.help}
          rows={4}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "number":
      return (
        <TextField
          id={id}
          label={field.label}
          type="number"
          min={field.min}
          max={field.max}
          value={Number(value ?? field.min)}
          onChange={(e) => onChange(Math.floor(Number(e.target.value) || field.min))}
        />
      );
    case "boolean":
      return (
        <UiField orientation="horizontal">
          <Switch id={id} checked={!!value} onCheckedChange={onChange} />
          <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
        </UiField>
      );
    case "select":
      return (
        <UiField>
          <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
          <select
            id={id}
            className="bg-background h-8 rounded-lg border px-2 text-sm"
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
          >
            {field.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </UiField>
      );
    case "product":
    case "collection": {
      const list = field.kind === "product" ? options.products : options.collections;
      return (
        <UiField>
          <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
          <select
            id={id}
            className="bg-background h-8 rounded-lg border px-2 text-sm"
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">Choose…</option>
            {list.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </UiField>
      );
    }
    case "products": {
      const ids = (value as string[]) ?? [];
      const names = new Map(options.products.map((p) => [p.id, p.name]));
      return (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">{field.label}</legend>
          <SortableList
            items={ids.map((x) => ({ id: x }))}
            className="flex flex-col gap-1"
            itemLabel={(i) => names.get(i.id) ?? "product"}
            onReorder={(items) => onChange(items.map((i) => i.id))}
            renderItem={(i) => (
              <div className="flex items-center justify-between rounded-md border px-2 py-1 text-sm">
                <span className="truncate">{names.get(i.id) ?? "Unknown product"}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Remove"
                  onClick={() => onChange(ids.filter((x) => x !== i.id))}
                >
                  <X />
                </Button>
              </div>
            )}
          />
          <select
            aria-label="Add a product"
            className="bg-background h-8 rounded-lg border px-2 text-sm"
            value=""
            onChange={(e) => e.target.value && onChange([...ids, e.target.value])}
          >
            <option value="">Add a product…</option>
            {options.products
              .filter((p) => !ids.includes(p.id))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </fieldset>
      );
    }
    case "image": {
      const mid = value as string | null;
      return (
        <ImageField
          label={field.label}
          value={mid && media[mid] ? { id: mid, ...media[mid] } : null}
          onChange={(v) => {
            if (v) setMedia({ ...media, [v.id]: { url: v.url, alt: v.alt ?? null } });
            onChange(v?.id ?? null);
          }}
        />
      );
    }
    case "images": {
      const ids = ((value as string[]) ?? []).filter((x) => media[x]);
      return (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">{field.label}</legend>
          <SortableList
            layout="grid"
            className="grid grid-cols-3 gap-2 sm:grid-cols-5"
            items={ids.map((x) => ({ id: x }))}
            itemLabel={(i) => media[i.id]?.alt || "image"}
            onReorder={(items) => onChange(items.map((i) => i.id))}
            renderItem={(i) => (
              <div className="bg-muted relative aspect-square overflow-hidden rounded-md border">
                <Image
                  src={media[i.id].url}
                  alt={media[i.id].alt ?? ""}
                  fill
                  sizes="120px"
                  className="object-cover"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-xs"
                  className="absolute top-1 right-1"
                  aria-label="Remove image"
                  onClick={() => onChange(ids.filter((x) => x !== i.id))}
                >
                  <X />
                </Button>
              </div>
            )}
          />
          <MediaPicker
            multiple
            onSelect={(items: MediaItem[]) => {
              const next = { ...media };
              for (const m of items) next[m.id] = { url: m.url, alt: m.alt };
              setMedia(next);
              onChange(
                [...ids, ...items.map((m) => m.id).filter((x) => !ids.includes(x))].slice(0, 5),
              );
            }}
            trigger={
              <Button type="button" variant="outline" size="sm" className="self-start">
                <ImagePlus /> Add images
              </Button>
            }
          />
        </fieldset>
      );
    }
    case "list": {
      const items = (value as string[]) ?? [];
      return (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">{field.label}</legend>
          {items.map((item, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1">
                <TextField
                  id={`${id}-${i}`}
                  label={`${field.itemLabel} ${i + 1}`}
                  value={item}
                  onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove ${field.itemLabel.toLowerCase()} ${i + 1}`}
                onClick={() => onChange(items.filter((_, j) => j !== i))}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => onChange([...items, ""])}
          >
            <Plus /> Add {field.itemLabel.toLowerCase()}
          </Button>
        </fieldset>
      );
    }
    case "repeater": {
      const items = (value as Obj[]) ?? [];
      return (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-medium">{field.label}</legend>
          {items.map((item, i) => (
            <div key={i} className="flex flex-col gap-3 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {field.itemLabel} {i + 1}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange(items.filter((_, j) => j !== i))}
                >
                  Remove
                </Button>
              </div>
              {field.fields.map((sub) => (
                <FieldInput
                  key={sub.key}
                  field={sub}
                  path={`${path}-${i}-${sub.key}`}
                  value={item[sub.key]}
                  onChange={(v) =>
                    onChange(items.map((x, j) => (j === i ? { ...x, [sub.key]: v } : x)))
                  }
                  media={media}
                  setMedia={setMedia}
                  options={options}
                />
              ))}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => onChange([...items, { ...field.blank }])}
          >
            <Plus /> Add {field.itemLabel.toLowerCase()}
          </Button>
        </fieldset>
      );
    }
  }
}

// A20 section editor: the form is generated from the section type's fields.
export function SectionForm({
  id,
  type,
  initial,
  media: initialMedia,
  options,
}: {
  id: string;
  type: SectionType;
  initial: Obj;
  media: Media;
  options: Options;
}) {
  const router = useRouter();
  const [data, setData] = useState<Obj>(initial);
  const [media, setMedia] = useState<Media>(initialMedia);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, start] = useTransition();

  function save() {
    const check = parseSection(type, data);
    if (!check.success) {
      setErrors(
        check.error.issues.map((i) => `${i.path.join(" ") || SECTION_LABELS[type]}: ${i.message}`),
      );
      return;
    }
    setErrors([]);
    start(async () => {
      const res = await saveSectionDraftAction({ id, data });
      if (!res.ok) return setErrors([res.error]);
      toast.success("Draft saved. Publish from the homepage list to make it live.");
      router.push("/admin/content/homepage");
    });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      {errors.length ? (
        <FormMessage>
          <ul className="ml-4 list-disc">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </FormMessage>
      ) : null}
      {SECTION_FIELDS[type].map((f) => (
        <FieldInput
          key={f.key}
          field={f}
          path={f.key}
          value={data[f.key]}
          onChange={(v) => setData((d) => ({ ...d, [f.key]: v }))}
          media={media}
          setMedia={setMedia}
          options={options}
        />
      ))}
      <div className="flex gap-2">
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save draft"}
        </Button>
        <Button variant="outline" onClick={() => router.push("/admin/content/homepage")}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
