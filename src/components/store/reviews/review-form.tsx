"use client";

import { Star } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { FormMessage, TextAreaField, TextField } from "@/components/form/text-field";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { submitReviewAction } from "@/server/actions/reviews";

// S23 review form
export function ReviewForm({
  orderItemId,
  productName,
  productSlug,
}: {
  orderItemId: string;
  productName: string;
  productSlug: string;
}) {
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");

  if (state === "done") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <FormMessage tone="success">
          Thank you! Your review is waiting for approval and will appear on the product page soon.
        </FormMessage>
        <Link href={`/products/${productSlug}`} className={buttonVariants({ variant: "outline" })}>
          Back to {productName}
        </Link>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        if (!rating) return setError("Choose a star rating.");
        setState("busy");
        const res = await submitReviewAction({ orderItemId, rating, title, body });
        if (!res.ok) {
          setError(res.error);
          setState("idle");
          return;
        }
        setState("done");
      }}
    >
      {error ? <FormMessage>{error}</FormMessage> : null}
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Your rating</legend>
        <div className="flex gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              onClick={() => setRating(n)}
              className="focus-visible:ring-ring/50 rounded p-1 focus-visible:ring-3 focus-visible:outline-none"
            >
              <Star
                className={cn(
                  "size-8",
                  n <= rating ? "fill-amber-700 text-amber-700" : "text-muted-foreground",
                )}
              />
            </button>
          ))}
        </div>
      </fieldset>
      <TextField
        id="r-title"
        label="Headline (optional)"
        maxLength={120}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <TextAreaField
        id="r-body"
        label="Your review"
        rows={6}
        maxLength={3000}
        description="What did you like? How did it fit or feel?"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <Button type="submit" size="lg" disabled={state === "busy"}>
        {state === "busy" ? "Sending…" : "Submit review"}
      </Button>
    </form>
  );
}
