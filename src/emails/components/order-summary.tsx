import { Column, Img, Link, Row, Section, Text } from "@react-email/components";

import { formatMoney } from "@/lib/money";

import { colors, mutedText, text } from "./layout";

export type EmailOrder = {
  number: string;
  currency: string;
  items: {
    name: string;
    variantLabel: string;
    quantity: number;
    lineTotal: number;
    imageUrl: string | null;
  }[];
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  total: number;
  couponCode: string | null;
  shippingAddress: {
    fullName: string;
    line1: string;
    line2?: string | null;
    city: string;
    state?: string | null;
    postalCode?: string | null;
    country: string;
  };
  shippingMethod: string;
  orderUrl: string;
};

const cell = { ...text, margin: 0, fontSize: "14px" };

export function OrderSummary({ order }: { order: EmailOrder }) {
  const money = (n: number) => formatMoney(n, order.currency);
  const a = order.shippingAddress;
  return (
    <Section>
      {order.items.map((item, i) => (
        <Row key={i} style={{ borderBottom: `1px solid ${colors.border}`, padding: "8px 0" }}>
          <Column style={{ width: "56px", verticalAlign: "top" }}>
            {item.imageUrl?.startsWith("http") ? (
              <Img
                src={item.imageUrl}
                width="48"
                height="48"
                alt=""
                style={{ borderRadius: "6px", objectFit: "cover" }}
              />
            ) : null}
          </Column>
          <Column style={{ verticalAlign: "top" }}>
            <Text style={cell}>
              {item.quantity} × {item.name}
            </Text>
            {item.variantLabel !== "Default" ? (
              <Text style={{ ...mutedText, margin: 0 }}>{item.variantLabel}</Text>
            ) : null}
          </Column>
          <Column style={{ width: "90px", textAlign: "right", verticalAlign: "top" }}>
            <Text style={cell}>{money(item.lineTotal)}</Text>
          </Column>
        </Row>
      ))}
      <Row style={{ paddingTop: "8px" }}>
        <Column>
          <Text style={{ ...cell, color: colors.muted }}>Subtotal</Text>
          {order.discountTotal > 0 ? (
            <Text style={{ ...cell, color: colors.muted }}>
              Discount{order.couponCode ? ` (${order.couponCode})` : ""}
            </Text>
          ) : null}
          <Text style={{ ...cell, color: colors.muted }}>Delivery ({order.shippingMethod})</Text>
          <Text style={{ ...cell, fontWeight: 600 }}>Total</Text>
        </Column>
        <Column style={{ textAlign: "right" }}>
          <Text style={cell}>{money(order.subtotal)}</Text>
          {order.discountTotal > 0 ? <Text style={cell}>−{money(order.discountTotal)}</Text> : null}
          <Text style={cell}>{money(order.shippingTotal)}</Text>
          <Text style={{ ...cell, fontWeight: 600 }}>{money(order.total)}</Text>
        </Column>
      </Row>
      <Text style={{ ...mutedText, marginTop: "16px" }}>
        Delivering to {a.fullName},{" "}
        {[a.line1, a.line2, a.city, a.state, a.postalCode, a.country].filter(Boolean).join(", ")}
      </Text>
      <Text style={mutedText}>
        <Link href={order.orderUrl} style={{ color: colors.primary }}>
          View order {order.number}
        </Link>
      </Text>
    </Section>
  );
}

export const sampleOrder: EmailOrder = {
  number: "RB-10001",
  currency: "GBP",
  items: [
    {
      name: "Whipped Shea Body Butter",
      variantLabel: "200 ml",
      quantity: 1,
      lineTotal: 2900,
      imageUrl: null,
    },
  ],
  subtotal: 2900,
  discountTotal: 0,
  shippingTotal: 395,
  total: 3295,
  couponCode: null,
  shippingAddress: {
    fullName: "Ada Lovelace",
    line1: "1 Test Street",
    city: "London",
    country: "United Kingdom",
  },
  shippingMethod: "Standard delivery",
  orderUrl: "http://localhost:3000/orders/track",
};
