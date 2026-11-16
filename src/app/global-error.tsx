"use client";

import "./globals.css";

// Last-resort error page when the root layout itself fails.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground flex min-h-svh items-center justify-center p-6">
        <main role="alert" className="flex max-w-md flex-col items-center gap-4 text-center">
          <h1 className="text-3xl">Something went wrong</h1>
          <p>Please try again in a moment.</p>
          {error.digest ? <p className="font-mono text-xs">Reference: {error.digest}</p> : null}
          <button
            type="button"
            onClick={reset}
            className="bg-primary text-primary-foreground rounded-lg px-4 py-2"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
