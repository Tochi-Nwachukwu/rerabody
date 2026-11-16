"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { FormMessage, TextAreaField, TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { stockAdjustSchema } from "@/lib/schemas/catalogue";
import { adjustStockAction, listMovementsAction } from "@/server/actions/catalogue";

type Movement = {
  id: string;
  delta: number;
  reason: string;
  note: string | null;
  createdAt: string;
  actor: string | null;
  orderNumber: string | null;
  orderId: string | null;
};

const REASON_LABEL: Record<string, string> = {
  RESTOCK: "Restock",
  SALE: "Sale",
  REFUND: "Refund",
  DAMAGE: "Damage",
  CORRECTION: "Correction",
};

// A8 adjust modal and movement history
export function InventoryRowActions({
  variantId,
  label,
  stock,
  canAdjust,
}: {
  variantId: string;
  label: string;
  stock: number;
  canAdjust: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<"adjust" | "history" | null>(null);
  const [mode, setMode] = useState<"add" | "remove" | "set">("add");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState<"RESTOCK" | "DAMAGE" | "CORRECTION">("RESTOCK");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [movements, setMovements] = useState<Movement[] | null>(null);
  const [pending, start] = useTransition();

  function openAdjust() {
    setMode("add");
    setAmount("");
    setReason("RESTOCK");
    setNote("");
    setError(null);
    setOpen("adjust");
  }

  function submit() {
    const n = Math.floor(Number(amount));
    if (!Number.isFinite(n) || amount.trim() === "" || n < 0)
      return setError("Enter a whole number of 0 or more.");
    const payload = {
      variantId,
      mode: mode === "set" ? ("set" as const) : ("delta" as const),
      amount: mode === "remove" ? -n : n,
      reason,
      note,
    };
    const check = stockAdjustSchema.safeParse(payload);
    if (!check.success) return setError(check.error.issues[0]?.message ?? "Check the form");
    start(async () => {
      const res = await adjustStockAction(payload);
      if (!res.ok) return setError(res.error);
      toast.success(`Stock is now ${res.data.stock}`);
      setOpen(null);
      router.refresh();
    });
  }

  return (
    <div className="flex justify-end gap-1">
      {canAdjust ? (
        <Button size="sm" variant="outline" onClick={openAdjust}>
          Adjust
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          setOpen("history");
          setMovements(null);
          start(async () => {
            const res = await listMovementsAction({ variantId });
            if (res.ok) setMovements(res.data);
            else toast.error(res.error);
          });
        }}
      >
        History
      </Button>

      <Dialog open={open === "adjust"} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust stock</DialogTitle>
            <DialogDescription>
              {label}. Current stock: {stock}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {error ? <FormMessage>{error}</FormMessage> : null}
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">Change</legend>
              <div className="bg-muted grid grid-cols-3 gap-1 rounded-lg p-1" role="radiogroup">
                {(["add", "remove", "set"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={mode === m}
                    onClick={() => {
                      setMode(m);
                      setReason(m === "add" ? "RESTOCK" : m === "remove" ? "DAMAGE" : "CORRECTION");
                    }}
                    className={`rounded-md px-2 py-1 text-sm ${mode === m ? "bg-background shadow-sm" : ""}`}
                  >
                    {m === "add" ? "Add" : m === "remove" ? "Remove" : "Set to"}
                  </button>
                ))}
              </div>
            </fieldset>
            <TextField
              id="adj-amount"
              label={mode === "set" ? "New stock count" : "Quantity"}
              type="number"
              min={0}
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Field>
              <FieldLabel htmlFor="adj-reason">Reason</FieldLabel>
              <select
                id="adj-reason"
                className="bg-background h-8 rounded-lg border px-2 text-sm"
                value={reason}
                onChange={(e) => setReason(e.target.value as typeof reason)}
              >
                {mode !== "remove" ? <option value="RESTOCK">Restock</option> : null}
                {mode !== "add" ? <option value="DAMAGE">Damage</option> : null}
                <option value="CORRECTION">Correction</option>
              </select>
            </Field>
            <TextAreaField
              id="adj-note"
              label="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending ? "Saving…" : "Save adjustment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open === "history"} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Stock history</DialogTitle>
            <DialogDescription>{label}</DialogDescription>
          </DialogHeader>
          {!movements ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : movements.length === 0 ? (
            <p className="text-muted-foreground text-sm">No movements recorded.</p>
          ) : (
            <ol className="flex max-h-96 flex-col divide-y overflow-y-auto text-sm">
              {movements.map((m) => (
                <li key={m.id} className="flex justify-between gap-3 py-2">
                  <div>
                    <p className="font-medium">
                      {REASON_LABEL[m.reason] ?? m.reason}
                      {m.orderNumber ? ` · Order ${m.orderNumber}` : ""}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {new Date(m.createdAt).toLocaleString("en-GB")} · {m.actor ?? "System"}
                    </p>
                    {m.note ? <p className="text-xs">{m.note}</p> : null}
                  </div>
                  <span className={m.delta < 0 ? "text-destructive font-medium" : "font-medium"}>
                    {m.delta > 0 ? `+${m.delta}` : m.delta}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
