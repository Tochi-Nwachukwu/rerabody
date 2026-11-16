"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { FormMessage, TextField } from "@/components/form/text-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { addressSchema } from "@/lib/schemas/checkout";
import { deleteAddressAction, saveAddressAction } from "@/server/actions/account";

const schema = addressSchema.extend({ id: z.string().optional(), isDefault: z.boolean() });
type Values = z.input<typeof schema>;
export type SavedAddress = Values & { id: string };

const blank: Values = {
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "United Kingdom",
  isDefault: false,
};

// S21 addresses
export function AddressBook({ addresses }: { addresses: SavedAddress[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Values | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const form = useForm<Values>({ resolver: zodResolver(schema), values: editing ?? blank });
  const e = form.formState.errors;

  return (
    <div className="flex flex-col gap-4">
      <Button
        className="self-start"
        onClick={() => {
          setError(null);
          setEditing(blank);
        }}
      >
        Add address
      </Button>
      {addresses.length === 0 ? (
        <p className="text-muted-foreground text-sm">No saved addresses yet.</p>
      ) : null}
      <ul className="grid gap-3 sm:grid-cols-2">
        {addresses.map((a) => (
          <li key={a.id} className="flex flex-col gap-2 rounded-xl border p-4 text-sm">
            {a.isDefault ? <Badge className="self-start">Default</Badge> : null}
            <address className="not-italic">
              {a.fullName}
              <br />
              {a.line1}
              <br />
              {a.line2 ? (
                <>
                  {a.line2}
                  <br />
                </>
              ) : null}
              {a.city}
              {a.state ? `, ${a.state}` : ""}
              <br />
              {a.postalCode ? (
                <>
                  {a.postalCode}
                  <br />
                </>
              ) : null}
              {a.country}
              <br />
              {a.phone}
            </address>
            <div className="mt-auto flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setError(null);
                  setEditing(a);
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
                    if (!window.confirm("Delete this address?")) return;
                    const res = await deleteAddressAction({ id: a.id });
                    if (!res.ok) return void toast.error(res.error);
                    router.refresh();
                  })
                }
              >
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit address" : "Add address"}</DialogTitle>
          </DialogHeader>
          <form
            id="address-form"
            className="flex flex-col gap-3"
            noValidate
            onSubmit={form.handleSubmit((values) =>
              start(async () => {
                const res = await saveAddressAction({ ...values, isDefault: !!values.isDefault });
                if (!res.ok) return setError(res.error);
                toast.success("Address saved");
                setEditing(null);
                router.refresh();
              }),
            )}
          >
            {error ? <FormMessage>{error}</FormMessage> : null}
            <TextField
              id="a-name"
              label="Full name"
              autoComplete="name"
              error={e.fullName?.message}
              {...form.register("fullName")}
            />
            <TextField
              id="a-phone"
              label="Phone"
              type="tel"
              autoComplete="tel"
              error={e.phone?.message}
              {...form.register("phone")}
            />
            <TextField
              id="a-line1"
              label="Address line 1"
              autoComplete="address-line1"
              error={e.line1?.message}
              {...form.register("line1")}
            />
            <TextField
              id="a-line2"
              label="Address line 2 (optional)"
              autoComplete="address-line2"
              {...form.register("line2")}
            />
            <TextField
              id="a-city"
              label="Town or city"
              autoComplete="address-level2"
              error={e.city?.message}
              {...form.register("city")}
            />
            <TextField
              id="a-state"
              label="County or state (optional)"
              autoComplete="address-level1"
              {...form.register("state")}
            />
            <TextField
              id="a-postcode"
              label="Postcode"
              autoComplete="postal-code"
              {...form.register("postalCode")}
            />
            <TextField
              id="a-country"
              label="Country"
              autoComplete="country-name"
              error={e.country?.message}
              {...form.register("country")}
            />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={!!form.getValues("isDefault")}
                onCheckedChange={(c) => form.setValue("isDefault", !!c, { shouldDirty: true })}
              />{" "}
              Use as my default address
            </label>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" form="address-form" disabled={pending}>
              {pending ? "Saving…" : "Save address"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
