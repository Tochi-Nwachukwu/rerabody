import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/admin/filter-bar";
import { PageHeader } from "@/components/admin/page-header";
import { Pager, firstParam, pageParam } from "@/components/admin/pager";
import { ReviewActions } from "@/components/admin/reviews/review-actions";
import { StatusBadge } from "@/components/admin/status-badge";
import { Stars } from "@/components/store/stars";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { requirePagePermission } from "@/server/auth/session";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Reviews" };

const TABS = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Published" },
  { value: "REJECTED", label: "Rejected" },
] as const;

// A14 review moderation
export default async function ReviewsPage({ searchParams }: PageProps<"/admin/reviews">) {
  await requirePagePermission("reviews.moderate");
  const sp = await searchParams;
  const status = TABS.find((t) => t.value === firstParam(sp.status))?.value ?? "PENDING";
  const page = pageParam(sp.page);
  const take = 20;
  const [reviews, total, counts] = await Promise.all([
    db.review.findMany({
      where: { status },
      orderBy: { createdAt: status === "PENDING" ? "asc" : "desc" },
      skip: (page - 1) * take,
      take,
      include: {
        product: { select: { id: true, name: true } },
        user: { select: { name: true, email: true } },
        orderItem: { select: { order: { select: { id: true, number: true } } } },
      },
    }),
    db.review.count({ where: { status } }),
    db.review.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;

  return (
    <>
      <PageHeader
        title="Reviews"
        description="Reviews stay hidden until approved. Approving, unpublishing or deleting updates the product rating."
      />
      <nav aria-label="Review status" className="mb-4 flex gap-1 border-b">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={`/admin/reviews?status=${t.value}`}
            aria-current={status === t.value ? "page" : undefined}
            className={cn(
              "border-b-2 px-3 py-2 text-sm",
              status === t.value
                ? "border-primary font-medium"
                : "text-muted-foreground border-transparent",
            )}
          >
            {t.label} ({count(t.value)})
          </Link>
        ))}
      </nav>
      {reviews.length === 0 ? (
        <EmptyState title={status === "PENDING" ? "No reviews waiting" : "Nothing here"} />
      ) : (
        <ul className="flex flex-col gap-3">
          {reviews.map((r) => (
            <li key={r.id} className="bg-card flex flex-col gap-2 rounded-xl border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Stars rating={r.rating} />
                <StatusBadge status={r.status} />
                {r.isFeatured ? <Badge variant="secondary">Featured</Badge> : null}
              </div>
              {r.title ? <p className="font-medium">{r.title}</p> : null}
              <p className="text-sm whitespace-pre-line">{r.body}</p>
              <p className="text-muted-foreground text-xs">
                {r.user.name} ({r.user.email}) on{" "}
                <Link
                  href={`/admin/products/${r.product.id}`}
                  className="underline underline-offset-4"
                >
                  {r.product.name}
                </Link>{" "}
                · order{" "}
                <Link
                  href={`/admin/orders/${r.orderItem.order.id}`}
                  className="underline underline-offset-4"
                >
                  {r.orderItem.order.number}
                </Link>{" "}
                · {r.createdAt.toLocaleDateString("en-GB", { dateStyle: "medium" })}
              </p>
              {r.rejectionReason ? (
                <p className="text-destructive text-xs">Rejected: {r.rejectionReason}</p>
              ) : null}
              <ReviewActions reviewId={r.id} status={r.status} isFeatured={r.isFeatured} />
            </li>
          ))}
        </ul>
      )}
      <Pager
        page={page}
        pageCount={Math.max(1, Math.ceil(total / take))}
        params={{ status }}
        basePath="/admin/reviews"
      />
    </>
  );
}
