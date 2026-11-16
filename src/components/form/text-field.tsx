import type { ComponentProps } from "react";

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type BaseProps = {
  label: string;
  error?: string;
  description?: string;
  id: string;
};

/** Label, input, description and error wired together for screen readers. */
export function TextField({
  label,
  error,
  description,
  id,
  ...props
}: BaseProps & ComponentProps<typeof Input>) {
  const describedBy = [description ? `${id}-desc` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");
  return (
    <Field data-invalid={!!error || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        aria-invalid={!!error || undefined}
        aria-describedby={describedBy || undefined}
        {...props}
      />
      {description ? <FieldDescription id={`${id}-desc`}>{description}</FieldDescription> : null}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </Field>
  );
}

export function TextAreaField({
  label,
  error,
  description,
  id,
  ...props
}: BaseProps & ComponentProps<typeof Textarea>) {
  const describedBy = [description ? `${id}-desc` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");
  return (
    <Field data-invalid={!!error || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Textarea
        id={id}
        aria-invalid={!!error || undefined}
        aria-describedby={describedBy || undefined}
        {...props}
      />
      {description ? <FieldDescription id={`${id}-desc`}>{description}</FieldDescription> : null}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </Field>
  );
}

export function FormMessage({
  tone = "error",
  children,
}: {
  tone?: "error" | "success" | "info";
  children: React.ReactNode;
}) {
  const styles = {
    error: "border-destructive/30 bg-destructive/5 text-destructive",
    success: "border-emerald-700/20 bg-emerald-50 text-emerald-900",
    info: "border-border bg-muted text-foreground",
  }[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-lg border px-3 py-2 text-sm ${styles}`}
    >
      {children}
    </div>
  );
}
