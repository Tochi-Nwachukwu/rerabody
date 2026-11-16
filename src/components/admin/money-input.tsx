"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { parseMoneyInput, toMoneyInput } from "@/lib/money";

/** Edits an integer minor-unit amount as a decimal string. */
export function MoneyInput({
  value,
  onChange,
  currency,
  nullable = false,
  ...props
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  currency: string;
  nullable?: boolean;
} & Omit<React.ComponentProps<typeof Input>, "value" | "onChange">) {
  // While focused, show what the user typed; otherwise show the formatted value.
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Input
      inputMode="decimal"
      {...props}
      value={draft ?? toMoneyInput(value, currency)}
      onFocus={() => setDraft(toMoneyInput(value, currency))}
      onChange={(e) => {
        setDraft(e.target.value);
        const parsed = parseMoneyInput(e.target.value, currency);
        if (parsed !== null) onChange(parsed);
        else if (nullable && e.target.value.trim() === "") onChange(null);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}
