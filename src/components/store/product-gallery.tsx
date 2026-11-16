"use client";

import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type GalleryImage = { id: string; url: string; alt: string };

// S5 gallery with hover zoom and a full-screen view
export function ProductGallery({
  images,
  index,
  onIndexChange,
  name,
}: {
  images: GalleryImage[];
  index: number;
  onIndexChange: (i: number) => void;
  name: string;
}) {
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [full, setFull] = useState(false);
  const current = images[index];

  if (!current) {
    return (
      <div className="bg-muted font-heading text-muted-foreground flex aspect-[4/5] items-center justify-center rounded-xl text-2xl">
        {name}
      </div>
    );
  }
  const step = (d: number) => onIndexChange((index + d + images.length) % images.length);

  return (
    <div className="flex flex-col gap-3">
      <div
        className="bg-muted relative aspect-[4/5] cursor-zoom-in overflow-hidden rounded-xl"
        onPointerMove={(e) => {
          if (e.pointerType !== "mouse") return;
          const r = e.currentTarget.getBoundingClientRect();
          setZoom({
            x: ((e.clientX - r.left) / r.width) * 100,
            y: ((e.clientY - r.top) / r.height) * 100,
          });
        }}
        onPointerLeave={() => setZoom(null)}
        onClick={() => setFull(true)}
      >
        <Image
          src={current.url}
          alt={current.alt}
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover transition-transform duration-150"
          style={
            zoom ? { transform: "scale(2)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined
          }
        />
        <Button
          variant="secondary"
          size="icon"
          className="absolute right-3 bottom-3"
          aria-label="View full screen"
          onClick={(e) => {
            e.stopPropagation();
            setFull(true);
          }}
        >
          <Expand />
        </Button>
        {images.length > 1 ? (
          <>
            <Button
              variant="secondary"
              size="icon"
              className="absolute top-1/2 left-2 -translate-y-1/2 md:hidden"
              aria-label="Previous image"
              onClick={(e) => {
                e.stopPropagation();
                step(-1);
              }}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="absolute top-1/2 right-2 -translate-y-1/2 md:hidden"
              aria-label="Next image"
              onClick={(e) => {
                e.stopPropagation();
                step(1);
              }}
            >
              <ChevronRight />
            </Button>
          </>
        ) : null}
      </div>
      {images.length > 1 ? (
        <ul className="flex gap-2 overflow-x-auto" aria-label="Product images">
          {images.map((img, i) => (
            <li key={img.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onIndexChange(i)}
                aria-label={`Show image ${i + 1} of ${images.length}`}
                aria-current={i === index}
                className={cn(
                  "bg-muted relative block size-16 overflow-hidden rounded-md border-2 sm:size-20",
                  i === index ? "border-primary" : "border-transparent",
                )}
              >
                <Image src={img.url} alt="" fill sizes="80px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <Dialog open={full} onOpenChange={setFull}>
        <DialogContent className="bg-background h-[100svh] max-w-none rounded-none p-0 sm:max-w-none">
          <DialogTitle className="sr-only">
            {name}: image {index + 1} of {images.length}
          </DialogTitle>
          <div className="relative h-full w-full">
            <Image
              src={current.url}
              alt={current.alt}
              fill
              sizes="100vw"
              className="object-contain"
            />
            {images.length > 1 ? (
              <>
                <Button
                  variant="secondary"
                  size="icon-lg"
                  className="absolute top-1/2 left-3 -translate-y-1/2"
                  aria-label="Previous image"
                  onClick={() => step(-1)}
                >
                  <ChevronLeft />
                </Button>
                <Button
                  variant="secondary"
                  size="icon-lg"
                  className="absolute top-1/2 right-3 -translate-y-1/2"
                  aria-label="Next image"
                  onClick={() => step(1)}
                >
                  <ChevronRight />
                </Button>
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
