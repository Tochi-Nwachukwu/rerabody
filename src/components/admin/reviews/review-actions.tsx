"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { moderateReviewAction } from "@/server/actions/reviews";

type Action = "approve" | "reject" | "unpublish" | "delete" | "feature" | "unfeature";

export function ReviewActions({
  reviewId,
  status,
  isFeatured,
}: {
  reviewId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  isFeatured: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (action: Action, done: string) =>
    start(async () => {
      let reason: string | null = null;
      if (action === "reject") {
        reason = window.prompt("Reason for rejecting (internal, optional)") ?? null;
      }
      if (action === "delete" && !window.confirm("Delete this review permanently?")) return;
      const res = await moderateReviewAction({ reviewId, action, reason });
      if (!res.ok) return void toast.error(res.error);
      toast.success(done);
      router.refresh();
    });
  return (
    <div className="flex flex-wrap gap-1.5">
      {status !== "APPROVED" ? (
        <Button
          size="sm"
          disabled={pending}
          onClick={() => run("approve", "Review approved and published")}
        >
          Approve
        </Button>
      ) : null}
      {status === "PENDING" ? (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run("reject", "Review rejected")}
        >
          Reject
        </Button>
      ) : null}
      {status === "APPROVED" ? (
        <>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run("unpublish", "Review unpublished")}
          >
            Unpublish
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              run(
                isFeatured ? "unfeature" : "feature",
                isFeatured ? "Removed from homepage" : "Featured on the homepage",
              )
            }
          >
            {isFeatured ? "Unfeature" : "Feature on homepage"}
          </Button>
        </>
      ) : null}
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => run("delete", "Review deleted")}
      >
        Delete
      </Button>
    </div>
  );
}
