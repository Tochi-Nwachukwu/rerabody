import { BadgeCheck } from "lucide-react";

import { getProductReviews } from "@/server/queries/reviews";

import { Stars } from "../stars";

// S5 reviews block: approved reviews only, each from a verified buyer.
export async function ReviewsBlock({
  productId,
  average,
  count,
}: {
  productId: string;
  average: number;
  count: number;
}) {
  const { reviews, distribution } = await getProductReviews(productId);
  return (
    <section id="reviews" aria-labelledby="reviews-title" className="mt-16 scroll-mt-24">
      <h2 id="reviews-title" className="font-heading mb-6 text-3xl">
        Reviews
      </h2>
      {count === 0 ? (
        <p className="text-muted-foreground">
          No reviews yet. Customers can review a product after it is delivered.
        </p>
      ) : (
        <div className="grid gap-10 md:grid-cols-[16rem_1fr]">
          <div className="flex flex-col gap-3">
            <p className="font-heading text-5xl">{average.toFixed(1)}</p>
            <Stars rating={average} count={count} size="md" />
            <dl className="flex flex-col gap-1 text-sm">
              {[5, 4, 3, 2, 1].map((star) => {
                const n = distribution[star] ?? 0;
                return (
                  <div key={star} className="flex items-center gap-2">
                    <dt className="w-12">{star} star</dt>
                    <dd className="flex flex-1 items-center gap-2">
                      <span className="bg-muted h-2 flex-1 overflow-hidden rounded" aria-hidden>
                        <span
                          className="block h-full bg-amber-700"
                          style={{ width: `${count ? (n / count) * 100 : 0}%` }}
                        />
                      </span>
                      <span className="w-6 text-right tabular-nums">{n}</span>
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
          <ul className="flex flex-col divide-y">
            {reviews.map((r) => (
              <li key={r.id} className="flex flex-col gap-1.5 py-4 first:pt-0">
                <Stars rating={r.rating} />
                {r.title ? <p className="font-medium">{r.title}</p> : null}
                <p className="text-sm whitespace-pre-line">{r.body}</p>
                <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  {r.author} ·{" "}
                  {new Date(r.createdAt).toLocaleDateString("en-GB", { dateStyle: "medium" })} ·
                  <span className="inline-flex items-center gap-1 text-emerald-800">
                    <BadgeCheck className="size-3.5" aria-hidden /> Verified buyer
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
