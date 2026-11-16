"use client";

import { Upload } from "lucide-react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { type MediaItem, uploadImage } from "@/lib/upload-client";

type Job = { id: string; name: string; progress: number; error?: string };

export function UploadZone({
  onUploaded,
  multiple = true,
  compact = false,
}: {
  onUploaded: (item: MediaItem) => void;
  multiple?: boolean;
  compact?: boolean;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [dragging, setDragging] = useState(false);

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files).slice(0, multiple ? 20 : 1);
    await Promise.all(
      list.map(async (file) => {
        const id = `${file.name}-${file.size}-${Math.random()}`;
        setJobs((j) => [...j, { id, name: file.name, progress: 0 }]);
        try {
          const item = await uploadImage(file, (progress) =>
            setJobs((j) => j.map((x) => (x.id === id ? { ...x, progress } : x))),
          );
          setJobs((j) => j.filter((x) => x.id !== id));
          onUploaded(item);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Upload failed";
          setJobs((j) => j.map((x) => (x.id === id ? { ...x, error: message } : x)));
          toast.error(message);
        }
      }),
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "bg-muted/40 text-muted-foreground hover:bg-muted focus-within:ring-ring/50 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-center text-sm transition-colors focus-within:ring-3",
          compact ? "px-3 py-4" : "px-4 py-8",
          dragging && "border-primary bg-muted",
        )}
      >
        <Upload className="size-5" aria-hidden />
        <span className="text-foreground font-medium">
          {multiple ? "Upload images" : "Upload an image"}
        </span>
        <span>Drop files here or choose from your device. JPEG, PNG or WebP, up to 8 MB.</span>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple={multiple}
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {jobs.length > 0 ? (
        <ul className="flex flex-col gap-1.5" aria-live="polite">
          {jobs.map((job) => (
            <li key={job.id} className="text-xs">
              <div className="flex justify-between gap-2">
                <span className="truncate">{job.name}</span>
                <span className={job.error ? "text-destructive" : "text-muted-foreground"}>
                  {job.error ? "Failed" : `${job.progress}%`}
                </span>
              </div>
              <div
                className="bg-muted mt-1 h-1.5 overflow-hidden rounded"
                role="progressbar"
                aria-valuenow={job.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Uploading ${job.name}`}
              >
                <div
                  className={cn(
                    "h-full transition-all",
                    job.error ? "bg-destructive" : "bg-primary",
                  )}
                  style={{ width: `${job.error ? 100 : job.progress}%` }}
                />
              </div>
              {job.error ? <p className="text-destructive mt-1">{job.error}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
