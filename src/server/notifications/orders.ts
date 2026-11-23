import "server-only";

import type { EmailOrder } from "@/emails/components/order-summary";
import type { OrderStatus } from "@/generated/prisma/client";
import { trackingUrl } from "@/lib/settings";
import { absoluteUrl } from "@/lib/site";
import { db } from "@/server/db";
import { sendEmail } from "@/server/email";
import { getSiteSettings } from "@/server/queries/settings";
import { signValue } from "@/server/signed-links";

/** Guest-safe link to S24 that needs no login. Signed, so nothing secret is stored. */
export function orderTrackingLink(orderId: string): string {
  return absoluteUrl(`/orders/track?order=${orderId}&sig=${signValue("order", orderId, null)}`);
}

export function reviewLink(orderItemId: string): string {
  return absoluteUrl(
    `/reviews/new?item=${orderItemId}&sig=${signValue("review", orderItemId, 120)}`,
  );
}

async function loadOrder(orderId: string) {
  return db.order.findUnique({
    where: { id: orderId },
    include: { items: true, user: { select: { name: true } }, payments: true },
  });
}

type LoadedOrder = NonNullable<Awaited<ReturnType<typeof loadOrder>>>;

function toEmailOrder(order: LoadedOrder): EmailOrder {
  const address = order.shippingAddress as EmailOrder["shippingAddress"];
  const method = order.shippingMethod as { name?: string };
  return {
    number: order.number,
    currency: order.currency,
    items: order.items.map((i) => ({
      name: i.productName,
      variantLabel: i.variantLabel,
      quantity: i.quantity,
      lineTotal: i.lineTotal,
      imageUrl: i.imageUrl
        ? i.imageUrl.startsWith("/")
          ? absoluteUrl(i.imageUrl)
          : i.imageUrl
        : null,
    })),
    subtotal: order.subtotal,
    discountTotal: order.discountTotal,
    shippingTotal: order.shippingTotal,
    taxTotal: order.taxTotal,
    total: order.total,
    couponCode: order.couponCode,
    shippingAddress: address,
    shippingMethod: method.name ?? "Delivery",
    orderUrl: orderTrackingLink(order.id),
  };
}

function customerName(order: LoadedOrder) {
  const address = order.shippingAddress as { fullName?: string };
  return (order.user?.name || address.fullName || "there").split(" ")[0];
}

/**
 * Sends the customer email for a status (and the admin alert for PAID).
 * Dedupe key `{orderId}:{status}` (section 11), so repeated calls send once.
 * Pass a suffix to deliberately send again (A11 "resend email").
 */
export async function notifyOrderStatus(
  orderId: string,
  status: OrderStatus,
  opts: { resendSuffix?: string } = {},
) {
  const order = await loadOrder(orderId);
  if (!order) return;
  const key = (k: string) => `${k}${opts.resendSuffix ? `:resend:${opts.resendSuffix}` : ""}`;
  const name = customerName(order);
  const emailOrder = toEmailOrder(order);
  const to = order.email;
  const settings = await getSiteSettings();

  switch (status) {
    case "PAID": {
      await sendEmail({
        template: "order-confirmation",
        to,
        dedupeKey: key(`${order.id}:PAID`),
        props: { name, order: emailOrder },
      });
      const admin = settings.notifications.adminAlertEmail;
      if (admin && !opts.resendSuffix) {
        await sendEmail({
          template: "admin-new-order",
          to: admin,
          dedupeKey: `${order.id}:PAID:admin`,
          props: {
            order: emailOrder,
            adminUrl: absoluteUrl(`/admin/orders/${order.id}`),
            email: order.email,
            needsReview: order.needsManualReview,
            reviewReason: order.manualReviewReason,
          },
        });
      }
      return;
    }
    case "PROCESSING":
      await sendEmail({
        template: "order-processing",
        to,
        dedupeKey: key(`${order.id}:PROCESSING`),
        props: { name, order: emailOrder },
      });
      return;
    case "SHIPPED":
      await sendEmail({
        template: "order-shipped",
        to,
        dedupeKey: key(`${order.id}:SHIPPED`),
        props: {
          name,
          order: emailOrder,
          carrier: order.trackingCarrier,
          trackingNumber: order.trackingNumber,
          trackingUrl: trackingUrl(settings.tracking, order.trackingCarrier, order.trackingNumber),
        },
      });
      return;
    case "OUT_FOR_DELIVERY":
      await sendEmail({
        template: "order-out-for-delivery",
        to,
        dedupeKey: key(`${order.id}:OUT_FOR_DELIVERY`),
        props: {
          name,
          order: emailOrder,
          trackingUrl: trackingUrl(settings.tracking, order.trackingCarrier, order.trackingNumber),
        },
      });
      return;
    case "DELIVERED": {
      const seen = new Set<string>();
      const reviewLinks = order.items
        .filter((i) => i.productId && !seen.has(i.productId) && seen.add(i.productId))
        .map((i) => ({ name: i.productName, url: reviewLink(i.id) }));
      await sendEmail({
        template: "order-delivered-review",
        to,
        dedupeKey: key(`${order.id}:DELIVERED`),
        props: { name, order: emailOrder, reviewLinks },
      });
      return;
    }
    case "CANCELLED": {
      const refunded = order.payments.reduce((s, p) => s + p.refundedAmount, 0);
      await sendEmail({
        template: "order-cancelled",
        to,
        dedupeKey: key(`${order.id}:CANCELLED`),
        props: { name, order: emailOrder, refunded },
      });
      return;
    }
    default:
      return;
  }
}

export async function notifyRefund(
  orderId: string,
  refundId: string,
  amount: number,
  fullRefund: boolean,
) {
  const order = await loadOrder(orderId);
  if (!order) return;
  await sendEmail({
    template: "order-refunded",
    to: order.email,
    dedupeKey: `${order.id}:REFUND:${refundId}`,
    props: { name: customerName(order), order: toEmailOrder(order), amount, fullRefund },
  });
}
