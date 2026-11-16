import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** GET form that keeps list filters in the URL. */
export function FilterBar({
  action,
  q,
  placeholder,
  children,
}: {
  action: string;
  q?: string;
  placeholder: string;
  children?: ReactNode;
}) {
  return (
    <form
      action={action}
      className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"
    >
      <Input
        name="q"
        defaultValue={q}
        placeholder={placeholder}
        aria-label={placeholder}
        className="sm:max-w-xs"
      />
      {children}
      <Button type="submit" variant="outline">
        Apply
      </Button>
    </form>
  );
}

export function FilterSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      name={name}
      defaultValue={value ?? ""}
      aria-label={label}
      className="bg-background h-8 rounded-lg border px-2 text-sm"
    >
      <option value="">{label}: all</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed px-4 py-12 text-center">
      <p className="font-medium">{title}</p>
      {children ? <div className="text-muted-foreground mt-1 text-sm">{children}</div> : null}
    </div>
  );
}
