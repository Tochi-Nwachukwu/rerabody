import { Button, Heading, Link, Text } from "@react-email/components";

import { formatMoney } from "@/lib/money";

import { EmailLayout, button, colors, heading, mutedText, text } from "./components/layout";
import { type EmailOrder, OrderSummary, sampleOrder } from "./components/order-summary";

type Base = { name: string; order: EmailOrder };

export function OrderConfirmation({ name, order }: Base) {
  return (
    <EmailLayout preview={`Order ${order.number} confirmed`}>
      <Heading style={heading}>Thank you for your order</Heading>
      <Text style={text}>
        Hi {name}, we have received your payment and your order {order.number} is confirmed. We will
        email you when it ships.
      </Text>
      <OrderSummary order={order} />
    </EmailLayout>
  );
}
OrderConfirmation.PreviewProps = { name: "Ada", order: sampleOrder };

export function AdminNewOrder({
  order,
  adminUrl,
  email,
  needsReview,
  reviewReason,
  isGift = false,
  giftMessage = null,
}: {
  order: EmailOrder;
  adminUrl: string;
  email: string;
  needsReview: boolean;
  reviewReason: string | null;
  isGift?: boolean;
  giftMessage?: string | null;
}) {
  return (
    <EmailLayout
      preview={`New order ${order.number} · ${formatMoney(order.total, order.currency)}`}
    >
      <Heading style={heading}>New order {order.number}</Heading>
      {needsReview ? (
        <Text style={{ ...text, color: "#9f1d1d", fontWeight: 600 }}>
          Needs manual review: {reviewReason}
        </Text>
      ) : null}
      <Text style={text}>
        {email} paid {formatMoney(order.total, order.currency)}.
      </Text>
      {isGift ? (
        <Text style={{ ...text, fontWeight: 600 }}>
          Gift order{giftMessage ? `. Message for the box: "${giftMessage}"` : "."}
        </Text>
      ) : null}
      <Button href={adminUrl} style={button}>
        Open in admin
      </Button>
      <OrderSummary order={order} />
    </EmailLayout>
  );
}
AdminNewOrder.PreviewProps = {
  order: sampleOrder,
  adminUrl: "http://localhost:3000/admin/orders/x",
  email: "ada@example.com",
  needsReview: false,
  reviewReason: null,
};

export function OrderProcessing({ name, order }: Base) {
  return (
    <EmailLayout preview={`We are preparing order ${order.number}`}>
      <Heading style={heading}>Your order is being prepared</Heading>
      <Text style={text}>
        Hi {name}, we are packing order {order.number} now. We will email you again when it is on
        its way.
      </Text>
      <OrderSummary order={order} />
    </EmailLayout>
  );
}
OrderProcessing.PreviewProps = { name: "Ada", order: sampleOrder };

export function OrderShipped({
  name,
  order,
  carrier,
  trackingNumber,
  trackingUrl,
}: Base & { carrier: string | null; trackingNumber: string | null; trackingUrl: string | null }) {
  return (
    <EmailLayout preview={`Order ${order.number} has shipped`}>
      <Heading style={heading}>Your order is on its way</Heading>
      <Text style={text}>
        Hi {name}, order {order.number} has left us.
      </Text>
      {carrier || trackingNumber ? (
        <Text style={text}>
          {carrier ? `Carrier: ${carrier}. ` : ""}
          {trackingNumber ? `Tracking number: ${trackingNumber}.` : ""}
        </Text>
      ) : null}
      {trackingUrl ? (
        <Button href={trackingUrl} style={button}>
          Track your parcel
        </Button>
      ) : null}
      <OrderSummary order={order} />
    </EmailLayout>
  );
}
OrderShipped.PreviewProps = {
  name: "Ada",
  order: sampleOrder,
  carrier: "Royal Mail",
  trackingNumber: "AB123456789GB",
  trackingUrl: "https://example.com/track",
};

export function OrderOutForDelivery({
  name,
  order,
  trackingUrl,
}: Base & { trackingUrl: string | null }) {
  return (
    <EmailLayout preview={`Order ${order.number} is out for delivery`}>
      <Heading style={heading}>Out for delivery today</Heading>
      <Text style={text}>
        Hi {name}, order {order.number} is with the courier and should arrive today.
      </Text>
      {trackingUrl ? (
        <Button href={trackingUrl} style={button}>
          Track your parcel
        </Button>
      ) : null}
      <OrderSummary order={order} />
    </EmailLayout>
  );
}
OrderOutForDelivery.PreviewProps = { name: "Ada", order: sampleOrder, trackingUrl: null };

export function OrderDeliveredReview({
  name,
  order,
  reviewLinks,
}: Base & { reviewLinks: { name: string; url: string }[] }) {
  return (
    <EmailLayout preview={`Order ${order.number} was delivered`}>
      <Heading style={heading}>Delivered</Heading>
      <Text style={text}>
        Hi {name}, order {order.number} has been delivered. We hope you love it.
      </Text>
      {reviewLinks.length ? (
        <>
          <Text style={text}>
            Would you tell us what you think? Your review helps other customers choose.
          </Text>
          {reviewLinks.map((r) => (
            <Text key={r.url} style={text}>
              <Link href={r.url} style={{ color: colors.primary, fontWeight: 600 }}>
                Review {r.name}
              </Link>
            </Text>
          ))}
        </>
      ) : null}
      <Text style={mutedText}>
        <Link href={order.orderUrl} style={{ color: colors.muted }}>
          View your order
        </Link>
      </Text>
    </EmailLayout>
  );
}
OrderDeliveredReview.PreviewProps = {
  name: "Ada",
  order: sampleOrder,
  reviewLinks: [{ name: "Vanilla Body Butter", url: "http://localhost:3000/reviews/new" }],
};

export function OrderCancelled({ name, order, refunded }: Base & { refunded: number }) {
  return (
    <EmailLayout preview={`Order ${order.number} was cancelled`}>
      <Heading style={heading}>Your order was cancelled</Heading>
      <Text style={text}>
        Hi {name}, order {order.number} has been cancelled.
      </Text>
      {refunded > 0 ? (
        <Text style={text}>
          We have refunded {formatMoney(refunded, order.currency)} to your original payment method.
          It can take a few working days to appear.
        </Text>
      ) : (
        <Text style={text}>You have not been charged.</Text>
      )}
      <Text style={mutedText}>If you did not expect this, reply to this email or contact us.</Text>
    </EmailLayout>
  );
}
OrderCancelled.PreviewProps = { name: "Ada", order: sampleOrder, refunded: 0 };

export function OrderRefunded({
  name,
  order,
  amount,
  fullRefund,
}: Base & { amount: number; fullRefund: boolean }) {
  return (
    <EmailLayout preview={`Refund for order ${order.number}`}>
      <Heading style={heading}>
        {fullRefund ? "Your order was refunded" : "You have received a refund"}
      </Heading>
      <Text style={text}>
        Hi {name}, we have refunded {formatMoney(amount, order.currency)} for order {order.number}{" "}
        to your original payment method. It can take a few working days to appear.
      </Text>
      <Text style={mutedText}>
        <Link href={order.orderUrl} style={{ color: colors.muted }}>
          View your order
        </Link>
      </Text>
    </EmailLayout>
  );
}
OrderRefunded.PreviewProps = { name: "Ada", order: sampleOrder, amount: 3295, fullRefund: true };
