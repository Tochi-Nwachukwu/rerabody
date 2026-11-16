"use client";

import Image from "next/image";

import { MediaPicker } from "@/components/admin/media/media-picker";
import { Button } from "@/components/ui/button";
import type { MediaItem } from "@/lib/upload-client";

export type ImageValue = { id: string; url: string; alt?: string | null } | null;

/** One image chosen from the media library. */
export function ImageField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ImageValue;
  onChange: (v: ImageValue) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-3">
        <div className="bg-muted relative size-20 shrink-0 overflow-hidden rounded-md border">
          {value ? (
            <Image
              src={value.url}
              alt={value.alt ?? ""}
              fill
              sizes="80px"
              className="object-cover"
            />
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <MediaPicker
            onSelect={(items: MediaItem[]) =>
              items[0] && onChange({ id: items[0].id, url: items[0].url, alt: items[0].alt })
            }
            trigger={
              <Button type="button" variant="outline" size="sm">
                {value ? "Change image" : "Choose image"}
              </Button>
            }
          />
          {value ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              Remove
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
