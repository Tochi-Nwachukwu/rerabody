"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { RichTextEditor, type RichTextValue } from "@/components/admin/rich-text-editor";
import { FormMessage, TextField } from "@/components/form/text-field";
import { Button, buttonVariants } from "@/components/ui/button";
import type { RichText } from "@/lib/schemas/catalogue";
import { slugify } from "@/lib/slug";
import {
  deletePageAction,
  publishPageAction,
  savePageAction,
  unpublishPageAction,
} from "@/server/actions/content";

type PageState = {
  id?: string;
  slug: string;
  title: string;
  draftBody: RichTextValue;
  metaTitle: string;
  metaDescription: string;
};

// A21 page editor: edits a draft; Publish copies it live.
export function PageEditor({
  initial,
  published,
  hasDraft,
  system,
}: {
  initial: PageState;
  published: boolean;
  hasDraft: boolean;
  system: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function save(): Promise<string | null> {
    const res = await savePageAction({
      ...state,
      draftBody: state.draftBody as RichText,
      metaTitle: state.metaTitle,
      metaDescription: state.metaDescription,
    });
    if (!res.ok) {
      setError(res.error);
      return null;
    }
    setError(null);
    return res.data.id;
  }

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      {error ? <FormMessage>{error}</FormMessage> : null}
      <p className="text-muted-foreground text-sm" role="status">
        {published
          ? hasDraft
            ? "Published, with unpublished changes."
            : "Published."
          : "Not published yet."}
      </p>
      <TextField
        id="pg-title"
        label="Title"
        value={state.title}
        onChange={(e) =>
          setState({
            ...state,
            title: e.target.value,
            slug: state.id ? state.slug : slugify(e.target.value),
          })
        }
      />
      <TextField
        id="pg-slug"
        label="URL slug"
        description={`/${state.slug || "…"}`}
        value={state.slug}
        disabled={system}
        onChange={(e) => setState({ ...state, slug: e.target.value.toLowerCase() })}
      />
      <RichTextEditor
        id="pg-body"
        label="Content"
        value={state.draftBody}
        onChange={(v) => setState({ ...state, draftBody: v })}
        minHeight="18rem"
      />
      <TextField
        id="pg-meta-title"
        label="Meta title"
        maxLength={70}
        value={state.metaTitle}
        onChange={(e) => setState({ ...state, metaTitle: e.target.value })}
      />
      <TextField
        id="pg-meta-desc"
        label="Meta description"
        maxLength={170}
        value={state.metaDescription}
        onChange={(e) => setState({ ...state, metaDescription: e.target.value })}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const id = await save();
              if (!id) return;
              toast.success("Draft saved");
              if (!state.id) router.replace(`/admin/content/pages/${id}`);
              else router.refresh();
            })
          }
        >
          Save draft
        </Button>
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const id = await save();
              if (!id) return;
              const res = await publishPageAction({ id });
              if (!res.ok) return setError(res.error);
              toast.success("Page published");
              if (!state.id) router.replace(`/admin/content/pages/${id}`);
              else router.refresh();
            })
          }
        >
          Publish
        </Button>
        {state.id ? (
          <Link
            href={`/${state.slug}?preview=1`}
            target="_blank"
            className={buttonVariants({ variant: "ghost" })}
          >
            Preview draft
          </Link>
        ) : null}
        {state.id && published ? (
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await unpublishPageAction({ id: state.id! });
                if (!r.ok) return setError(r.error);
                toast.success("Page unpublished");
                router.refresh();
              })
            }
          >
            Unpublish
          </Button>
        ) : null}
        {state.id && !system ? (
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              start(async () => {
                if (!window.confirm("Delete this page?")) return;
                const r = await deletePageAction({ id: state.id! });
                if (!r.ok) return setError(r.error);
                router.replace("/admin/content/pages");
              })
            }
          >
            Delete
          </Button>
        ) : null}
      </div>
    </div>
  );
}
