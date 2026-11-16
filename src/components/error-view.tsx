"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button, buttonVariants } from "@/components/ui/button";

/** Shared body for error.tsx files. */
export function ErrorView({
  error,
  reset,
  homeHref = "/",
  homeLabel = "Go to the homepage",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  homeHref?: string;
  homeLabel?: string;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div
      role="alert"
      className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-24 text-center"
    >
      <h1 className="font-heading text-4xl">Something went wrong</h1>
      <p className="text-muted-foreground">
        Sorry, this page could not be loaded. Please try again.
      </p>
      {error.digest ? (
        <p className="text-muted-foreground font-mono text-xs">Reference: {error.digest}</p>
      ) : null}
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <Link href={homeHref} className={buttonVariants({ variant: "outline" })}>
          {homeLabel}
        </Link>
      </div>
    </div>
  );
}
