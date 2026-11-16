import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function AdminNotFound() {
  return (
    <div className="flex flex-col items-start gap-3 py-12">
      <h1 className="font-heading text-3xl">Not found</h1>
      <p className="text-muted-foreground">That record does not exist or was deleted.</p>
      <Link href="/admin" className={buttonVariants({ variant: "outline" })}>
        Back to the dashboard
      </Link>
    </div>
  );
}
