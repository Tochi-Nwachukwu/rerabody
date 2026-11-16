import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

export function Stars({
  rating,
  count,
  size = "sm",
  className,
}: {
  rating: number;
  count?: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const rounded = Math.round(rating * 2) / 2;
  const label = `Rated ${rating.toFixed(1)} out of 5${count !== undefined ? ` from ${count} review${count === 1 ? "" : "s"}` : ""}`;
  return (
    <span className={cn("inline-flex items-center gap-1", className)} role="img" aria-label={label}>
      <span className="flex" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={cn(
              size === "sm" ? "size-3.5" : "size-4.5",
              i <= rounded
                ? "fill-amber-700 text-amber-700"
                : i - 0.5 === rounded
                  ? "fill-amber-700/50 text-amber-700"
                  : "text-muted-foreground/50",
            )}
          />
        ))}
      </span>
      {count !== undefined ? (
        <span className="text-muted-foreground text-xs" aria-hidden>
          ({count})
        </span>
      ) : null}
    </span>
  );
}
