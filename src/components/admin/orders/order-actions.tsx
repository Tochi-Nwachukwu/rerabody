"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { MoneyInput } from "@/components/admin/money-input";
import { FormMessage, TextAreaField, TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { formatMoney } from "@/lib/money";
import {
  cancelOrderAction,
  clearManualReviewAction,
  refundOrderAction,
  resendOrderEmailAction,
  updateOrderStatusAction,
  updateTrackingAction,
} from "@/server/actions/orders";

type Status =
  | "PENDING_PAYMENT"
  | "PAID"
  | "PROCESSING"
  | "SHIPPED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

const NEXT: Partial<
  Record<
    Status,
    { to: "PROCESSING" | "SHIPPED" | "OUT_FOR_DELIVERY" | "DELIVERED"; label: string }[]
  >
> = {
  PAID: [{ to: "PROCESSING", label: "Mark processing" }],
  PROCESSING: [{ to: "SHIPPED", label: "Mark shipped" }],
  SHIPPED: [
    { to: "OUT_FOR_DELIVERY", label: "Mark out for delivery" },
    { to: "DELIVERED", label: "Mark delivered" },
  ],
  OUT_FOR_DELIVERY: [{ to: "DELIVERED", label: "Mark delivered" }],
};

// A11 action panel
export function OrderActions({
  orderId,
  status,
  currency,
  refundable,
  needsReview,
  carrier,
  trackingNumber,
  carriers,
  canUpdate,
  canRefund,
}: {
  orderId: string;
  status: Status;
  currency: string;
  refundable: number;
  needsReview: boolean;
  carrier: string | null;
  trackingNumber: string | null;
  carriers: string[];
  canUpdate: boolean;
  canRefund: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [dialog, setDialog] = useState<"ship" | "tracking" | "cancel" | "refund" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    carrier: carrier ?? carriers[0] ?? "",
    tracking: trackingNumber ?? "",
    note: "",
    restock: true,
    amount: refundable as number | null,
  });

  function run<T>(fn: () => Promise<{ ok: boolean; error?: string; data?: T }>, success: string) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error ?? "Something went wrong");
        toast.error(res.error ?? "Something went wrong");
        return;
      }
      toast.success(success);
      setDialog(null);
      router.refresh();
    });
  }

  const moves = NEXT[status] ?? [];
  const canCancel =
    ["PENDING_PAYMENT", "PAID", "PROCESSING"].includes(status) &&
    (status === "PENDING_PAYMENT" ? canUpdate : canUpdate && canRefund);
  const open = (d: typeof dialog) => {
    setError(null);
    setForm((f) => ({ ...f, amount: refundable, note: "" }));
    setDialog(d);
  };

  return (
    <div className="flex flex-col gap-2">
      {canUpdate
        ? moves.map((m) => (
            <Button
              key={m.to}
              disabled={pending}
              onClick={() =>
                m.to === "SHIPPED"
                  ? open("ship")
                  : run(
                      () => updateOrderStatusAction({ orderId, to: m.to }),
                      "Status updated, customer emailed",
                    )
              }
            >
              {m.label}
            </Button>
          ))
        : null}
      {canUpdate && ["SHIPPED", "OUT_FOR_DELIVERY"].includes(status) ? (
        <Button variant="outline" disabled={pending} onClick={() => open("tracking")}>
          Edit tracking
        </Button>
      ) : null}
      {canRefund &&
      refundable > 0 &&
      !["PENDING_PAYMENT", "CANCELLED", "REFUNDED"].includes(status) ? (
        <Button variant="outline" disabled={pending} onClick={() => open("refund")}>
          Refund
        </Button>
      ) : null}
      {canCancel ? (
        <Button variant="outline" disabled={pending} onClick={() => open("cancel")}>
          Cancel order
        </Button>
      ) : null}
      {canUpdate && !["PENDING_PAYMENT", "REFUNDED"].includes(status) ? (
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() => run(() => resendOrderEmailAction({ orderId }), "Email sent again")}
        >
          Resend status email
        </Button>
      ) : null}
      {canUpdate && needsReview ? (
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() => run(() => clearManualReviewAction({ orderId }), "Review flag cleared")}
        >
          Mark review done
        </Button>
      ) : null}

      <Dialog
        open={dialog === "ship" || dialog === "tracking"}
        onOpenChange={(o) => !o && setDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog === "ship" ? "Mark as shipped" : "Edit tracking"}</DialogTitle>
            <DialogDescription>
              {dialog === "ship"
                ? "The customer receives an email with the tracking details."
                : "Updates the tracking shown to the customer."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {error ? <FormMessage>{error}</FormMessage> : null}
            <Field>
              <FieldLabel htmlFor="carrier">Carrier</FieldLabel>
              <input
                id="carrier"
                list="carriers"
                className="bg-background h-8 rounded-lg border px-2.5 text-sm"
                value={form.carrier}
                onChange={(e) => setForm({ ...form, carrier: e.target.value })}
              />
              <datalist id="carriers">
                {carriers.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <TextField
              id="tracking"
              label="Tracking number"
              value={form.tracking}
              onChange={(e) => setForm({ ...form, tracking: e.target.value })}
            />
            {dialog === "ship" ? (
              <TextAreaField
                id="ship-note"
                label="Internal note (optional)"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              disabled={pending || !form.carrier.trim() || !form.tracking.trim()}
              onClick={() =>
                dialog === "ship"
                  ? run(
                      () =>
                        updateOrderStatusAction({
                          orderId,
                          to: "SHIPPED",
                          carrier: form.carrier,
                          trackingNumber: form.tracking,
                          note: form.note || null,
                        }),
                      "Marked shipped, customer emailed",
                    )
                  : run(
                      () =>
                        updateTrackingAction({
                          orderId,
                          carrier: form.carrier,
                          trackingNumber: form.tracking,
                        }),
                      "Tracking updated",
                    )
              }
            >
              {pending ? "Saving…" : dialog === "ship" ? "Mark shipped" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "cancel"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this order?</DialogTitle>
            <DialogDescription>
              {status === "PENDING_PAYMENT"
                ? "The order has not been paid, so nothing is refunded."
                : `The payment of ${formatMoney(refundable, currency)} will be refunded in full.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {error ? <FormMessage>{error}</FormMessage> : null}
            {status !== "PENDING_PAYMENT" ? (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.restock}
                  onCheckedChange={(c) => setForm({ ...form, restock: !!c })}
                />{" "}
                Return the items to stock
              </label>
            ) : null}
            <TextAreaField
              id="cancel-reason"
              label="Reason (optional, internal)"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Keep order
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                run(
                  () =>
                    cancelOrderAction({
                      orderId,
                      restock: form.restock,
                      reason: form.note || null,
                    }),
                  "Order cancelled",
                )
              }
            >
              {pending ? "Cancelling…" : "Cancel order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "refund"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refund</DialogTitle>
            <DialogDescription>
              Up to {formatMoney(refundable, currency)} can be refunded. A full refund marks the
              order refunded.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {error ? <FormMessage>{error}</FormMessage> : null}
            <Field>
              <FieldLabel htmlFor="refund-amount">Amount</FieldLabel>
              <MoneyInput
                id="refund-amount"
                currency={currency}
                value={form.amount}
                onChange={(v) => setForm({ ...form, amount: v })}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.restock}
                onCheckedChange={(c) => setForm({ ...form, restock: !!c })}
              />{" "}
              Return the items to stock
            </label>
            <TextAreaField
              id="refund-reason"
              label="Reason (optional, internal)"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending || !form.amount || form.amount > refundable}
              onClick={() =>
                run(
                  () =>
                    refundOrderAction({
                      orderId,
                      amount: form.amount ?? 0,
                      restock: form.restock,
                      reason: form.note || null,
                    }),
                  "Refund issued, customer emailed",
                )
              }
            >
              {pending ? "Refunding…" : `Refund ${formatMoney(form.amount ?? 0, currency)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
