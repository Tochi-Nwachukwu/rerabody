"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { MoneyInput } from "@/components/admin/money-input";
import { FormMessage, TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { type CouponInput, couponSchema } from "@/lib/schemas/coupon";
import { saveCouponAction, setCouponActiveAction } from "@/server/actions/coupons";

// A16 coupon editor
export function CouponEditor({
  initial,
  products,
  categories,
  currency,
}: {
  initial: CouponInput;
  products: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  currency: string;
}) {
  const router = useRouter();
  const [c, setC] = useState<CouponInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof CouponInput>(k: K, v: CouponInput[K]) =>
    setC((x) => ({ ...x, [k]: v }));
  const toggle = (key: "restrictedProductIds" | "restrictedCategoryIds", id: string, on: boolean) =>
    set(key, on ? [...c[key], id] : c[key].filter((x) => x !== id));

  function save() {
    const check = couponSchema.safeParse(c);
    if (!check.success) return setError(check.error.issues[0]?.message ?? "Check the form");
    setError(null);
    start(async () => {
      const res = await saveCouponAction(c);
      if (!res.ok) return setError(res.error);
      toast.success("Coupon saved");
      if (!c.id) router.replace(`/admin/coupons/${res.data.id}`);
      else router.refresh();
    });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      {error ? <FormMessage>{error}</FormMessage> : null}
      <TextField
        id="c-code"
        label="Code"
        description="Customers type this at checkout. Stored in capitals."
        value={c.code}
        onChange={(e) => set("code", e.target.value.toUpperCase())}
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Discount</legend>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="type"
              checked={c.type === "PERCENT"}
              onChange={() => set("type", "PERCENT")}
            />{" "}
            Percentage
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="type"
              checked={c.type === "FIXED"}
              onChange={() => set("type", "FIXED")}
            />{" "}
            Fixed amount
          </label>
        </div>
        {c.type === "PERCENT" ? (
          <TextField
            id="c-value"
            label="Percent off"
            type="number"
            min={1}
            max={100}
            value={c.value}
            onChange={(e) => set("value", Math.floor(Number(e.target.value) || 0))}
          />
        ) : (
          <Field>
            <FieldLabel htmlFor="c-value-money">Amount off</FieldLabel>
            <MoneyInput
              id="c-value-money"
              currency={currency}
              value={c.value}
              onChange={(v) => set("value", v ?? 0)}
            />
          </Field>
        )}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="c-start"
          label="Starts (optional)"
          type="datetime-local"
          value={c.startsAt ?? ""}
          onChange={(e) => set("startsAt", e.target.value || null)}
        />
        <TextField
          id="c-end"
          label="Ends (optional)"
          type="datetime-local"
          value={c.endsAt ?? ""}
          onChange={(e) => set("endsAt", e.target.value || null)}
        />
      </div>
      <Field>
        <FieldLabel htmlFor="c-min">Minimum spend (optional)</FieldLabel>
        <MoneyInput
          id="c-min"
          nullable
          currency={currency}
          value={c.minSpend}
          onChange={(v) => set("minSpend", v)}
          placeholder="None"
        />
        <FieldDescription>Compared with the cart subtotal before the discount.</FieldDescription>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="c-limit"
          label="Total uses allowed (optional)"
          type="number"
          min={1}
          value={c.usageLimit ?? ""}
          onChange={(e) =>
            set(
              "usageLimit",
              e.target.value ? Math.max(1, Math.floor(Number(e.target.value))) : null,
            )
          }
        />
        <TextField
          id="c-per"
          label="Uses per customer (optional)"
          type="number"
          min={1}
          value={c.perCustomerLimit ?? ""}
          onChange={(e) =>
            set(
              "perCustomerLimit",
              e.target.value ? Math.max(1, Math.floor(Number(e.target.value))) : null,
            )
          }
        />
      </div>
      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-sm font-medium">
          Limit to products or categories (
          {c.restrictedProductIds.length + c.restrictedCategoryIds.length} chosen)
        </summary>
        <p className="text-muted-foreground mt-2 text-xs">
          Leave empty to apply to the whole cart. Otherwise only matching items are discounted.
        </p>
        <fieldset className="mt-3 flex flex-col gap-1.5">
          <legend className="mb-1 text-sm font-medium">Categories</legend>
          {categories.map((cat) => (
            <label key={cat.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={c.restrictedCategoryIds.includes(cat.id)}
                onCheckedChange={(on) => toggle("restrictedCategoryIds", cat.id, !!on)}
              />{" "}
              {cat.name}
            </label>
          ))}
        </fieldset>
        <fieldset className="mt-3 flex max-h-64 flex-col gap-1.5 overflow-y-auto">
          <legend className="mb-1 text-sm font-medium">Products</legend>
          {products.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={c.restrictedProductIds.includes(p.id)}
                onCheckedChange={(on) => toggle("restrictedProductIds", p.id, !!on)}
              />{" "}
              {p.name}
            </label>
          ))}
        </fieldset>
      </details>
      <Field orientation="horizontal">
        <Switch id="c-active" checked={c.isActive} onCheckedChange={(v) => set("isActive", v)} />
        <FieldLabel htmlFor="c-active">Active</FieldLabel>
      </Field>
      <Field orientation="horizontal">
        <Switch
          id="c-offers"
          checked={c.showOnOffers}
          onCheckedChange={(v) => set("showOnOffers", v)}
        />
        <FieldLabel htmlFor="c-offers">Show on the offers page</FieldLabel>
      </Field>
      <div className="flex gap-2">
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save coupon"}
        </Button>
        {c.id ? (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await setCouponActiveAction({ id: c.id!, isActive: !c.isActive });
                if (!res.ok) return setError(res.error);
                set("isActive", !c.isActive);
                toast.success(c.isActive ? "Coupon disabled" : "Coupon enabled");
                router.refresh();
              })
            }
          >
            {c.isActive ? "Disable now" : "Enable now"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
