import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ShopPager({
  page,
  pageCount,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Pages" className="mt-10 flex items-center justify-center gap-3 text-sm">
      {page > 1 ? (
        <Link
          href={hrefFor(page - 1)}
          className={buttonVariants({ variant: "outline" })}
          rel="prev"
        >
          Previous
        </Link>
      ) : null}
      <span>
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? (
        <Link
          href={hrefFor(page + 1)}
          className={cn(buttonVariants({ variant: "outline" }))}
          rel="next"
        >
          Next
        </Link>
      ) : null}
    </nav>
  );
}
