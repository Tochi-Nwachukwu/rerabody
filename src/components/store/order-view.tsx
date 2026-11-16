import { Check } from "lucide-react";

import { statusLabel } from "@/components/admin/status-badge";
import { formatMoney } from "@/lib/money";
import { trackingUrl, type SiteSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";
import type { OrderViewData } from "@/server/services/account";

type Address = {
  fullName: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
};

const STEPS = ["PAID", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"] as const;
const STEP_LABEL: Record<(typeof STEPS)[number], string> = {
  PAID: "Confirmed",
  PROCESSING: "Preparing",
  SHIPPED: "Shipped",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
};

// S20 and S24: status timeline from OrderStatusEvent rows, tracking, items and totals.
export function OrderView({
  order,
  tracking,
}: {
  order: OrderViewData;
  tracking: SiteSettings["tracking"];
}) {
  const money = (n: number) => formatMoney(n, order.currency);
  const reached = new Map(order.statusEvents.map((e) => [e.toStatus, e.createdAt]));
  const ended = order.status === "CANCELLED" || order.status === "REFUNDED";
  const a = order.shippingAddress as Address;
  const link = trackingUrl(tracking, order.trackingCarrier, order.trackingNumber);
  const refunded = order.payments.reduce((s, p) => s + p.refundedAmount, 0);

  return (
    <div className="flex flex-col gap-8">
      {ended ? (
        <p role="status" className="bg-muted rounded-lg border px-4 py-3 text-sm">
          This order was {statusLabel(order.status).toLowerCase()} on{" "}
          {(reached.get(order.status) ?? order.updatedAt).toLocaleDateString("en-GB", {
            dateStyle: "long",
          })}
          .{refunded > 0 ? ` ${money(refunded)} was refunded to your original payment method.` : ""}
        </p>
      ) : (
        <ol className="grid grid-cols-5 gap-1" aria-label="Order progress">
          {STEPS.map((s) => {
            const at = reached.get(s);
            const done = !!at || (s === "OUT_FOR_DELIVERY" && reached.has("DELIVERED"));
            return (
              <li key={s} className="flex flex-col items-center gap-1.5 text-center">
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full border-2",
                    done ? "border-primary bg-primary text-primary-foreground" : "border-border",
                  )}
                  aria-hidden
                >
                  {done ? <Check className="size-4" /> : null}
                </span>
                <span
                  className={cn(
                    "text-xs leading-tight",
                    done ? "font-medium" : "text-muted-foreground",
                  )}
                >
                  {STEP_LABEL[s]}
                  <span className="sr-only">{done ? ", done" : ", not yet"}</span>
                </span>
                {at ? (
                  <span className="text-muted-foreground text-[10px]">
                    {at.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
      {order.trackingNumber ? (
        <p className="text-sm">
          {order.trackingCarrier ? `${order.trackingCarrier} tracking: ` : "Tracking: "}
          {link ? (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline underline-offset-4"
            >
              {order.trackingNumber}
            </a>
          ) : (
            <span className="font-medium">{order.trackingNumber}</span>
          )}
        </p>
      ) : null}
      <section aria-labelledby="items" className="rounded-xl border p-5">
        <h2 id="items" className="font-heading mb-3 text-2xl">
          Items
        </h2>
        <ul className="flex flex-col divide-y text-sm">
          {order.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3 py-2">
              <span>
                {i.quantity} × {i.productName}
                {i.variantLabel !== "Default" ? (
                  <span className="text-muted-foreground block text-xs">{i.variantLabel}</span>
                ) : null}
              </span>
              <span className="tabular-nums">{money(i.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 flex flex-col gap-1 border-t pt-3 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd className="tabular-nums">{money(order.subtotal)}</dd>
          </div>
          {order.discountTotal > 0 ? (
            <div className="flex justify-between">
              <dt>Discount</dt>
              <dd className="tabular-nums">−{money(order.discountTotal)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt>Delivery</dt>
            <dd className="tabular-nums">{money(order.shippingTotal)}</dd>
          </div>
          <div className="flex justify-between font-medium">
            <dt>Total</dt>
            <dd className="tabular-nums">{money(order.total)}</dd>
          </div>
        </dl>
      </section>
      <section aria-labelledby="delivery" className="rounded-xl border p-5 text-sm">
        <h2 id="delivery" className="font-heading mb-2 text-2xl">
          Delivery address
        </h2>
        <address className="not-italic">
          {a.fullName}
          <br />
          {a.line1}
          <br />
          {a.line2 ? (
            <>
              {a.line2}
              <br />
            </>
          ) : null}
          {a.city}
          {a.state ? `, ${a.state}` : ""}
          <br />
          {a.postalCode ? (
            <>
              {a.postalCode}
              <br />
            </>
          ) : null}
          {a.country}
        </address>
      </section>
    </div>
  );
}
