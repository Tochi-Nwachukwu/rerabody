"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

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
import { deleteFaqAction, reorderFaqsAction, saveFaqAction } from "@/server/actions/content";

type Faq = { id: string; topic: string; question: string; answer: string };
type Draft = Omit<Faq, "id"> & { id?: string };

// A22 FAQ manager
export function FaqManager({ initial }: { initial: Faq[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const topics = [...new Set(rows.map((r) => r.topic))];

  return (
    <div className="flex flex-col gap-4">
      <Button
        className="self-start"
        onClick={() => {
          setError(null);
          setDraft({ topic: topics[0] ?? "", question: "", answer: "" });
        }}
      >
        Add question
      </Button>
      <SortableList
        items={rows}
        className="flex flex-col gap-2"
        itemLabel={(r) => r.question}
        onReorder={(next) => {
          setRows(next);
          start(async () => {
            const res = await reorderFaqsAction({ ids: next.map((r) => r.id) });
            if (!res.ok) toast.error(res.error);
          });
        }}
        renderItem={(r) => (
          <div className="bg-card flex items-start justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs tracking-wide uppercase">{r.topic}</p>
              <p className="font-medium">{r.question}</p>
              <p className="text-muted-foreground line-clamp-2 text-sm">{r.answer}</p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setError(null);
                  setDraft(r);
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
                    if (!window.confirm("Delete this question?")) return;
                    const res = await deleteFaqAction({ id: r.id });
                    if (!res.ok) return void toast.error(res.error);
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
            <DialogTitle>{draft?.id ? "Edit question" : "Add question"}</DialogTitle>
          </DialogHeader>
          {draft ? (
            <div className="flex flex-col gap-4">
              {error ? <FormMessage>{error}</FormMessage> : null}
              <TextField
                id="faq-topic"
                label="Topic"
                list="faq-topics"
                value={draft.topic}
                onChange={(e) => setDraft({ ...draft, topic: e.target.value })}
              />
              <datalist id="faq-topics">
                {topics.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
              <TextField
                id="faq-q"
                label="Question"
                value={draft.question}
                onChange={(e) => setDraft({ ...draft, question: e.target.value })}
              />
              <TextAreaField
                id="faq-a"
                label="Answer"
                rows={6}
                value={draft.answer}
                onChange={(e) => setDraft({ ...draft, answer: e.target.value })}
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  if (!draft) return;
                  const res = await saveFaqAction(draft);
                  if (!res.ok) return setError(res.error);
                  toast.success("Saved");
                  setDraft(null);
                  router.refresh();
                  if (!draft.id) setRows((x) => [...x, { ...draft, id: res.data.id }]);
                  else
                    setRows((x) => x.map((y) => (y.id === draft.id ? { ...draft, id: y.id } : y)));
                })
              }
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
