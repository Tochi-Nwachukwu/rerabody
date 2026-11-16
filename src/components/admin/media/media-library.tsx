"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { FormMessage, TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MediaItem } from "@/lib/upload-client";
import { deleteMediaAction, updateMediaAltAction } from "@/server/actions/media";

import { UploadZone } from "./upload-zone";

type Item = MediaItem & { bytes: number; mimeType: string; createdAt: string };

export function MediaLibrary({
  items,
  canUpload,
  canDelete,
}: {
  items: Item[];
  canUpload: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [active, setActive] = useState<Item | null>(null);
  const [alt, setAlt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function open(item: Item) {
    setActive(item);
    setAlt(item.alt ?? "");
    setError(null);
  }

  return (
    <div className="flex flex-col gap-6">
      {canUpload ? <UploadZone onUploaded={() => router.refresh()} /> : null}
      {items.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-10 text-center text-sm">
          No images yet.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => open(item)}
                className="group flex w-full flex-col gap-1 text-left outline-none"
              >
                <span className="bg-muted group-focus-visible:ring-ring/50 relative block aspect-square overflow-hidden rounded-md border group-focus-visible:ring-3">
                  <Image
                    src={item.url}
                    alt={item.alt ?? ""}
                    fill
                    sizes="(min-width: 1024px) 160px, 45vw"
                    className="object-cover"
                  />
                </span>
                <span className="text-muted-foreground truncate text-xs">
                  {item.alt || "No alt text"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Image details</DialogTitle>
          </DialogHeader>
          {active ? (
            <div className="flex flex-col gap-4">
              <div className="bg-muted relative aspect-video overflow-hidden rounded-md border">
                <Image
                  src={active.url}
                  alt={active.alt ?? ""}
                  fill
                  sizes="480px"
                  className="object-contain"
                />
              </div>
              <dl className="text-muted-foreground grid grid-cols-2 gap-1 text-xs">
                <dt>Size</dt>
                <dd>{(active.bytes / 1024).toFixed(0)} KB</dd>
                <dt>Dimensions</dt>
                <dd>
                  {active.width && active.height ? `${active.width} × ${active.height}` : "Unknown"}
                </dd>
                <dt>Type</dt>
                <dd>{active.mimeType}</dd>
              </dl>
              {error ? <FormMessage>{error}</FormMessage> : null}
              <TextField
                id="media-alt"
                label="Alt text"
                description="Describe the image for people using screen readers."
                value={alt}
                onChange={(e) => setAlt(e.target.value)}
                disabled={!canUpload}
              />
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:justify-between">
            {canDelete ? (
              <Button
                variant="destructive"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    if (!active) return;
                    if (!window.confirm("Delete this image? This cannot be undone.")) return;
                    const res = await deleteMediaAction({ mediaId: active.id });
                    if (!res.ok) {
                      setError(res.error);
                      return;
                    }
                    toast.success("Image deleted");
                    setActive(null);
                    router.refresh();
                  })
                }
              >
                Delete
              </Button>
            ) : (
              <span />
            )}
            {canUpload ? (
              <Button
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    if (!active) return;
                    const res = await updateMediaAltAction({ mediaId: active.id, alt });
                    if (!res.ok) {
                      setError(res.error);
                      return;
                    }
                    toast.success("Alt text saved");
                    setActive(null);
                    router.refresh();
                  })
                }
              >
                Save
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
