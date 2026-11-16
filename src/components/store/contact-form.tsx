"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { FormMessage, TextAreaField, TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { type ContactInput, contactSchema } from "@/lib/schemas/contact";
import { submitContactAction } from "@/server/actions/support";

// S28 contact form
export function ContactForm({ defaults }: { defaults: { name: string; email: string } }) {
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: { ...defaults, orderNumber: "", subject: "", message: "", website: "" },
  });
  const e = form.formState.errors;
  if (done)
    return (
      <FormMessage tone="success">
        Thank you. Your reference is {done}. We have emailed you a copy and will reply by email.
      </FormMessage>
    );
  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={form.handleSubmit(async (values) => {
        setError(null);
        const res = await submitContactAction(values);
        if (!res.ok) return setError(res.error);
        setDone(res.data.number);
      })}
    >
      {error ? <FormMessage>{error}</FormMessage> : null}
      <TextField
        id="ct-name"
        label="Name"
        autoComplete="name"
        error={e.name?.message}
        {...form.register("name")}
      />
      <TextField
        id="ct-email"
        label="Email"
        type="email"
        autoComplete="email"
        error={e.email?.message}
        {...form.register("email")}
      />
      <TextField
        id="ct-order"
        label="Order number (optional)"
        placeholder="RB-10001"
        {...form.register("orderNumber")}
      />
      <TextField
        id="ct-subject"
        label="Subject"
        error={e.subject?.message}
        {...form.register("subject")}
      />
      <TextAreaField
        id="ct-message"
        label="Message"
        rows={6}
        error={e.message?.message}
        {...form.register("message")}
      />
      <div aria-hidden className="absolute -left-[9999px]">
        <label htmlFor="ct-website">Leave this empty</label>
        <input id="ct-website" tabIndex={-1} autoComplete="off" {...form.register("website")} />
      </div>
      <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
