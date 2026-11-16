"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { updateCustomerAction } from "@/server/actions/customers";

export function CustomerForm({
  id,
  name,
  phone,
  status,
}: {
  id: string;
  name: string;
  phone: string;
  status: "ACTIVE" | "DEACTIVATED" | "INVITED";
}) {
  const router = useRouter();
  const [form, setForm] = useState({ name, phone });
  const [pending, start] = useTransition();
  const save = (nextStatus: "ACTIVE" | "DEACTIVATED") =>
    start(async () => {
      const res = await updateCustomerAction({
        id,
        name: form.name,
        phone: form.phone,
        status: nextStatus,
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success("Customer updated");
      router.refresh();
    });
  const current = status === "DEACTIVATED" ? "DEACTIVATED" : "ACTIVE";
  return (
    <div className="flex flex-col gap-3">
      <TextField
        id="cu-name"
        label="Name"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />
      <TextField
        id="cu-phone"
        label="Phone"
        value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={pending} onClick={() => save(current)}>
          Save
        </Button>
        <Button
          size="sm"
          variant={current === "ACTIVE" ? "destructive" : "outline"}
          disabled={pending}
          onClick={() =>
            current === "ACTIVE"
              ? window.confirm(
                  "Deactivate this account? The customer is signed out and cannot sign in.",
                ) && save("DEACTIVATED")
              : save("ACTIVE")
          }
        >
          {current === "ACTIVE" ? "Deactivate account" : "Reactivate account"}
        </Button>
      </div>
    </div>
  );
}
