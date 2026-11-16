"use client";

import { Copy, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { SortableList } from "@/components/admin/sortable-list";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  SECTION_LABELS,
  SECTION_TYPES,
  type SectionType,
  sectionSummary,
} from "@/lib/home-sections";
import { cn } from "@/lib/utils";
import {
  addSectionAction,
  discardHomepageAction,
  duplicateSectionAction,
  publishHomepageAction,
  removeSectionAction,
  reorderSectionsAction,
  setSectionVisibilityAction,
} from "@/server/actions/home";
import type { ActionResult } from "@/server/actions/safe-action";

type Row = {
  id: string;
  type: SectionType;
  isVisible: boolean;
  data: unknown;
  isNew: boolean;
  changed: boolean;
  valid: boolean;
};

// A19 homepage editor
export function HomepageEditor({ sections, hasChanges }: { sections: Row[]; hasChanges: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState(sections);
  const [pending, start] = useTransition();
  const [addType, setAddType] = useState<SectionType>("TEXT_IMAGE");

  function act<T>(fn: () => Promise<ActionResult<T>>, success?: string, after?: (data: T) => void) {
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      if (success) toast.success(success);
      after?.(res.data);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-card flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm" role="status">
          {hasChanges ? (
            <strong>You have unpublished changes.</strong>
          ) : (
            "The live homepage matches this list."
          )}{" "}
          Changes go live only when you publish.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/preview/home"
            target="_blank"
            className={buttonVariants({ variant: "outline" })}
          >
            Preview
          </Link>
          <Button
            variant="ghost"
            disabled={pending || !hasChanges}
            onClick={() =>
              window.confirm("Discard all unpublished changes?") &&
              act(
                () => discardHomepageAction({}),
                "Draft discarded",
                () => window.location.reload(),
              )
            }
          >
            Discard
          </Button>
          <Button
            disabled={pending || !hasChanges}
            onClick={() => act(() => publishHomepageAction({}), "Homepage published")}
          >
            Publish
          </Button>
        </div>
      </div>

      <SortableList
        items={rows}
        className="flex flex-col gap-2"
        itemLabel={(r) => SECTION_LABELS[r.type]}
        onReorder={(next) => {
          setRows(next);
          act(() => reorderSectionsAction({ ids: next.map((r) => r.id) }));
        }}
        renderItem={(r) => (
          <div
            className={cn(
              "bg-card flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between",
              !r.isVisible && "opacity-60",
            )}
          >
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {SECTION_LABELS[r.type]}
                {!r.isVisible ? <Badge variant="outline">Hidden</Badge> : null}
                {r.isNew ? (
                  <Badge variant="secondary">New</Badge>
                ) : r.changed ? (
                  <Badge variant="secondary">Edited</Badge>
                ) : null}
                {!r.valid ? <Badge variant="destructive">Needs attention</Badge> : null}
              </p>
              <p className="text-muted-foreground truncate text-sm">
                {sectionSummary(r.type, r.data) || "No content yet"}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Link
                href={`/admin/content/homepage/${r.id}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <Pencil /> Edit
              </Link>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={
                  r.isVisible ? `Hide ${SECTION_LABELS[r.type]}` : `Show ${SECTION_LABELS[r.type]}`
                }
                disabled={pending}
                onClick={() => {
                  setRows((x) =>
                    x.map((y) => (y.id === r.id ? { ...y, isVisible: !y.isVisible } : y)),
                  );
                  act(() => setSectionVisibilityAction({ id: r.id, visible: !r.isVisible }));
                }}
              >
                {r.isVisible ? <Eye /> : <EyeOff />}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Duplicate ${SECTION_LABELS[r.type]}`}
                disabled={pending}
                onClick={() =>
                  act(
                    () => duplicateSectionAction({ id: r.id }),
                    "Section duplicated",
                    () => window.location.reload(),
                  )
                }
              >
                <Copy />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete ${SECTION_LABELS[r.type]}`}
                disabled={pending}
                onClick={() => {
                  if (
                    !window.confirm(
                      "Delete this section? It disappears from the live page when you publish.",
                    )
                  )
                    return;
                  setRows((x) => x.filter((y) => y.id !== r.id));
                  act(() => removeSectionAction({ id: r.id }));
                }}
              >
                <Trash2 />
              </Button>
            </div>
          </div>
        )}
      />

      <div className="flex flex-col gap-2 rounded-xl border border-dashed p-4 sm:flex-row sm:items-center">
        <label htmlFor="add-type" className="text-sm font-medium">
          Add a section
        </label>
        <select
          id="add-type"
          className="bg-background h-8 rounded-lg border px-2 text-sm"
          value={addType}
          onChange={(e) => setAddType(e.target.value as SectionType)}
        >
          {SECTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {SECTION_LABELS[t]}
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            act(
              () => addSectionAction({ type: addType }),
              "Section added",
              (d) => router.push(`/admin/content/homepage/${d.id}`),
            )
          }
        >
          Add
        </Button>
      </div>
    </div>
  );
}
