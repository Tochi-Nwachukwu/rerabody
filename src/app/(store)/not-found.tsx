import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

// S31 not found (inside the store layout)
export default function StoreNotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-24 text-center">
      <p className="text-muted-foreground text-sm tracking-[0.2em] uppercase">404</p>
      <h1 className="font-heading text-4xl">We could not find that page</h1>
      <p className="text-muted-foreground">It may have moved, or the link may be out of date.</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/shop" className={buttonVariants()}>
          Shop all
        </Link>
        <Link href="/search" className={buttonVariants({ variant: "outline" })}>
          Search
        </Link>
      </div>
    </div>
  );
}
