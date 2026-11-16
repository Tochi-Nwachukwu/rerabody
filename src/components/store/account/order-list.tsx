import Link from "next/link";

import { StatusBadge } from "@/components/admin/status-badge";
import { formatMoney } from "@/lib/money";

export function OrderList({
  orders,
}: {
  orders: {
    id: string;
    number: string;
    status: string;
    total: number;
    currency: string;
    createdAt: Date;
    _count: { items: number };
  }[];
}) {
  if (!orders.length)
    return <p className="text-muted-foreground text-sm">You have not placed any orders yet.</p>;
  return (
    <ul className="flex flex-col divide-y rounded-xl border">
      {orders.map((o) => (
        <li key={o.id}>
          <Link
            href={`/account/orders/${o.id}`}
            className="hover:bg-muted/50 flex items-center justify-between gap-3 px-4 py-3"
          >
            <div>
              <p className="font-medium">{o.number}</p>
              <p className="text-muted-foreground text-xs">
                {o.createdAt.toLocaleDateString("en-GB", { dateStyle: "medium" })} ·{" "}
                {o._count.items} item{o._count.items === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <StatusBadge status={o.status} />
              <span className="text-sm tabular-nums">{formatMoney(o.total, o.currency)}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
