import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderActions } from "@/components/admin/orders/order-actions";
import { OrderNoteForm } from "@/components/admin/orders/order-notes";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge, statusLabel } from "@/components/admin/status-badge";
import { FormMessage } from "@/components/form/text-field";
import { buttonVariants } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { trackingUrl } from "@/lib/settings";
import { requirePagePermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { getSiteSettings } from "@/server/queries/settings";
import { getOrderAdmin } from "@/server/services/orders";

export const metadata: Metadata = { title: "Order" };

type Address = {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-card rounded-xl border p-4 sm:p-5">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

// A11 order detail
export default async function OrderDetailPage({ params }: PageProps<"/admin/orders/[id]">) {
  const staff = await requirePagePermission("orders.read");
  const { id } = await params;
  const [order, settings] = await Promise.all([getOrderAdmin(db, id), getSiteSettings()]);
  if (!order) notFound();
  const money = (n: number) => formatMoney(n, order.currency);
  const a = order.shippingAddress as Address;
  const method = order.shippingMethod as { name?: string; estimate?: string };
  const payment =
    order.payments.find(
      (p) => p.status !== "PENDING" && p.status !== "EXPIRED" && p.status !== "FAILED",
    ) ?? order.payments.at(-1);
  const refundable =
    payment && ["SUCCEEDED", "PARTIALLY_REFUNDED"].includes(payment.status)
      ? payment.amount - payment.refundedAmount
      : 0;
  const track = trackingUrl(settings.tracking, order.trackingCarrier, order.trackingNumber);

  return (
    <>
      <PageHeader
        title={`Order ${order.number}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={order.status} /> Placed{" "}
            {order.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
          </span>
        }
        actions={
          <Link
            href={`/admin/print/orders/${order.id}`}
            target="_blank"
            className={buttonVariants({ variant: "outline" })}
          >
            Packing slip
          </Link>
        }
      />
      {order.needsManualReview ? (
        <div className="mb-6">
          <FormMessage>
            <strong>Needs manual review.</strong> {order.manualReviewReason}
          </FormMessage>
        </div>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card title="Items">
            <ul className="flex flex-col divide-y text-sm">
              {order.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-3 py-2">
                  <div>
                    <p className="font-medium">{i.productName}</p>
                    <p className="text-muted-foreground text-xs">
                      {i.variantLabel !== "Default" ? `${i.variantLabel} · ` : ""}
                      {i.sku} · {i.quantity} × {money(i.unitPrice)}
                    </p>
                  </div>
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
                  <dt>Discount ({order.couponCode})</dt>
                  <dd className="tabular-nums">−{money(order.discountTotal)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt>Delivery ({method.name})</dt>
                <dd className="tabular-nums">{money(order.shippingTotal)}</dd>
              </div>
              <div className="flex justify-between font-medium">
                <dt>Total</dt>
                <dd className="tabular-nums">{money(order.total)}</dd>
              </div>
              {payment && payment.refundedAmount > 0 ? (
                <div className="text-destructive flex justify-between">
                  <dt>Refunded</dt>
                  <dd className="tabular-nums">−{money(payment.refundedAmount)}</dd>
                </div>
              ) : null}
            </dl>
          </Card>
          <Card title="Timeline">
            <ol className="flex flex-col gap-3 text-sm">
              {order.statusEvents.map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className="bg-primary mt-1.5 size-2 shrink-0 rounded-full" aria-hidden />
                  <div>
                    <p className="font-medium">{statusLabel(e.toStatus)}</p>
                    <p className="text-muted-foreground text-xs">
                      {e.createdAt.toLocaleString("en-GB", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}{" "}
                      · {e.actor?.name ?? "System"}
                    </p>
                    {e.note ? <p className="text-xs">{e.note}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
          <Card title="Internal notes">
            {staff.permissions.has("orders.update") ? <OrderNoteForm orderId={order.id} /> : null}
            <ul className="mt-3 flex flex-col gap-3 text-sm">
              {order.notes.map((n) => (
                <li key={n.id} className="bg-muted/50 rounded-lg p-3">
                  <p className="whitespace-pre-wrap">{n.body}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {n.author.name} ·{" "}
                    {n.createdAt.toLocaleString("en-GB", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <aside className="flex flex-col gap-6">
          <Card title="Actions">
            <OrderActions
              orderId={order.id}
              status={order.status}
              currency={order.currency}
              refundable={refundable}
              needsReview={order.needsManualReview}
              carrier={order.trackingCarrier}
              trackingNumber={order.trackingNumber}
              carriers={settings.tracking.carriers.map((c) => c.name)}
              canUpdate={staff.permissions.has("orders.update")}
              canRefund={staff.permissions.has("orders.refund")}
            />
          </Card>
          <Card title="Customer">
            <p className="text-sm">
              {order.user ? (
                <Link
                  href={`/admin/customers/${order.user.id}`}
                  className="underline underline-offset-4"
                >
                  {order.user.name}
                </Link>
              ) : (
                "Guest"
              )}
            </p>
            <p className="text-muted-foreground text-sm">{order.email}</p>
          </Card>
          <Card title="Delivery">
            <address className="text-sm not-italic">
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
            <p className="mt-2 text-sm">{a.phone}</p>
            <p className="text-muted-foreground mt-2 text-xs">
              {method.name}
              {method.estimate ? ` · ${method.estimate}` : ""}
            </p>
            {order.trackingNumber ? (
              <p className="mt-2 text-sm">
                {order.trackingCarrier}:{" "}
                {track ? (
                  <a
                    href={track}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-4"
                  >
                    {order.trackingNumber}
                  </a>
                ) : (
                  order.trackingNumber
                )}
              </p>
            ) : null}
          </Card>
          <Card title="Payment">
            {payment ? (
              <dl className="grid grid-cols-2 gap-1 text-sm">
                <dt className="text-muted-foreground">Provider</dt>
                <dd className="capitalize">{payment.provider}</dd>
                <dt className="text-muted-foreground">Status</dt>
                <dd>{payment.status.replaceAll("_", " ").toLowerCase()}</dd>
                <dt className="text-muted-foreground">Amount</dt>
                <dd className="tabular-nums">{money(payment.amount)}</dd>
                {payment.providerPaymentId ? (
                  <>
                    <dt className="text-muted-foreground">Reference</dt>
                    <dd className="truncate font-mono text-xs">{payment.providerPaymentId}</dd>
                  </>
                ) : null}
              </dl>
            ) : (
              <p className="text-muted-foreground text-sm">No payment yet.</p>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}
