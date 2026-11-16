import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Previous/next links that keep the rest of the URL state. */
export function Pager({
  page,
  pageCount,
  params,
  basePath,
}: {
  page: number;
  pageCount: number;
  params: Record<string, string | undefined>;
  basePath: string;
}) {
  if (pageCount <= 1) return null;
  const href = (p: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
    qs.set("page", String(p));
    return `${basePath}?${qs}`;
  };
  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-3 text-sm">
      <Link
        aria-disabled={page <= 1}
        href={href(page - 1)}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          page <= 1 && "pointer-events-none opacity-50",
        )}
      >
        Previous
      </Link>
      <span>
        Page {page} of {pageCount}
      </span>
      <Link
        aria-disabled={page >= pageCount}
        href={href(page + 1)}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          page >= pageCount && "pointer-events-none opacity-50",
        )}
      >
        Next
      </Link>
    </nav>
  );
}

export function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function pageParam(v: string | string[] | undefined): number {
  const n = Number(firstParam(v));
  return Number.isInteger(n) && n > 0 ? n : 1;
}
