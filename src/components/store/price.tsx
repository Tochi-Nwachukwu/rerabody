import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export function Price({
  amount,
  compareAt,
  currency,
  from = false,
  className,
}: {
  amount: number;
  compareAt?: number | null;
  currency: string;
  from?: boolean;
  className?: string;
}) {
  const onSale = !!compareAt && compareAt > amount;
  return (
    <p className={cn("flex flex-wrap items-baseline gap-x-2", className)}>
      <span className={cn(onSale && "text-red-800")}>
        {from ? <span className="text-muted-foreground text-sm">From </span> : null}
        {formatMoney(amount, currency)}
      </span>
      {onSale ? (
        <>
          <span className="sr-only">, was</span>
          <s className="text-muted-foreground text-sm">{formatMoney(compareAt!, currency)}</s>
        </>
      ) : null}
    </p>
  );
}
