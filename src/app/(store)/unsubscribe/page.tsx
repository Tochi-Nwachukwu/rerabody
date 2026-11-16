import type { Metadata } from "next";
import { Suspense } from "react";

import { UnsubscribeButton } from "@/components/store/unsubscribe-button";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };

// S30
export default function UnsubscribePage({ searchParams }: PageProps<"/unsubscribe">) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
      <h1 className="font-heading text-4xl">Unsubscribe</h1>
      <p className="text-muted-foreground">
        Stop receiving news and offers by email. Order emails are not affected.
      </p>
      <Suspense>
        <Confirm searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Confirm({
  searchParams,
}: {
  searchParams: PageProps<"/unsubscribe">["searchParams"];
}) {
  const sp = await searchParams;
  const s = typeof sp.s === "string" ? sp.s : "";
  const sig = typeof sp.sig === "string" ? sp.sig : "";
  if (!s || !sig)
    return <p className="text-sm">Use the unsubscribe link at the bottom of one of our emails.</p>;
  return <UnsubscribeButton s={s} sig={sig} />;
}
