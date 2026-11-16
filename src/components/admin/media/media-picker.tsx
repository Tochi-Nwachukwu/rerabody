"use client";

import { Check } from "lucide-react";
import Image from "next/image";
import { type ReactElement, useCallback, useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { MediaItem } from "@/lib/upload-client";
import { listMediaAction } from "@/server/actions/media";

import { UploadZone } from "./upload-zone";

/** A24 in picker mode: choose existing images or upload new ones. */
export function MediaPicker({
  trigger,
  multiple = false,
  onSelect,
  title = multiple ? "Choose images" : "Choose an image",
}: {
  trigger: ReactElement;
  multiple?: boolean;
  onSelect: (items: MediaItem[]) => void;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: MediaItem[]; pageCount: number } | null>(null);
  const [selected, setSelected] = useState<MediaItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const load = useCallback(
    (query: string, p: number) =>
      start(async () => {
        const res = await listMediaAction({ q: query || undefined, page: p });
        if (res.ok) {
          setData({ items: res.data.items, pageCount: res.data.pageCount });
          setError(null);
        } else setError(res.error);
      }),
    [],
  );

  useEffect(() => {
    if (open) load(q, page);
  }, [open, page, load]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle(item: MediaItem) {
    if (!multiple) {
      setSelected([item]);
      return;
    }
    setSelected((s) =>
      s.some((x) => x.id === item.id) ? s.filter((x) => x.id !== item.id) : [...s, item],
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setSelected([]);
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <UploadZone
          compact
          multiple={multiple}
          onUploaded={(item) => {
            setData((d) =>
              d ? { ...d, items: [item, ...d.items] } : { items: [item], pageCount: 1 },
            );
            toggle(item);
          }}
        />
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            load(q, 1);
          }}
        >
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by alt text"
            aria-label="Search images"
          />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        <div className={cn("grid grid-cols-3 gap-2 sm:grid-cols-5", pending && "opacity-60")}>
          {data?.items.map((item) => {
            const isSelected = selected.some((s) => s.id === item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggle(item)}
                aria-pressed={isSelected}
                aria-label={item.alt || "Image without alt text"}
                className={cn(
                  "bg-muted focus-visible:ring-ring/50 relative aspect-square overflow-hidden rounded-md border outline-none focus-visible:ring-3",
                  isSelected && "ring-primary ring-2",
                )}
              >
                <Image src={item.url} alt="" fill sizes="160px" className="object-cover" />
                {isSelected ? (
                  <span className="bg-primary text-primary-foreground absolute top-1 right-1 rounded-full p-0.5">
                    <Check className="size-3.5" />
                  </span>
                ) : null}
              </button>
            );
          })}
          {data && data.items.length === 0 ? (
            <p className="text-muted-foreground col-span-full py-6 text-center text-sm">
              No images yet. Upload one above.
            </p>
          ) : null}
        </div>
        {data && data.pageCount > 1 ? (
          <div className="flex items-center justify-center gap-2 text-sm">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span>
              Page {page} of {data.pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.pageCount}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={selected.length === 0}
            onClick={() => {
              onSelect(selected);
              setOpen(false);
              setSelected([]);
            }}
          >
            {multiple ? `Add ${selected.length || ""} selected` : "Use this image"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
