import type { ComponentType } from "react";

import {
  AdminNewOrder,
  OrderCancelled,
  OrderConfirmation,
  OrderDeliveredReview,
  OrderOutForDelivery,
  OrderProcessing,
  OrderRefunded,
  OrderShipped,
} from "./order-emails";
import NewsletterWelcome from "./newsletter-welcome";
import PasswordReset from "./password-reset";
import SettingsTest from "./settings-test";
import { LowStock, StaffInvite } from "./staff-emails";
import { TicketReceived, TicketReply } from "./ticket-emails";
import VerifyEmail from "./verify-email";
import Welcome from "./welcome";

export type EmailStream = "orders" | "marketing";

type TemplateDef<P> = {
  component: ComponentType<P>;
  subject: (props: P) => string;
  /** Picks the From address. Marketing mail is suppressed for unsubscribed or bounced addresses. */
  stream: EmailStream;
};

function define<P>(def: TemplateDef<P>): TemplateDef<P> {
  return def;
}

/**
 * Every email the store sends. Section 11 of BUILD_PLAN.md lists triggers and dedupe keys.
 * Later phases add templates here.
 */
export const emailTemplates = {
  "verify-email": define({
    component: VerifyEmail,
    subject: () => "Confirm your email address",
    stream: "orders",
  }),
  "password-reset": define({
    component: PasswordReset,
    subject: () => "Reset your password",
    stream: "orders",
  }),
  welcome: define({ component: Welcome, subject: () => "Welcome to Rera Body", stream: "orders" }),
  "order-confirmation": define({
    component: OrderConfirmation,
    subject: (p) => `Order ${p.order.number} confirmed`,
    stream: "orders",
  }),
  "admin-new-order": define({
    component: AdminNewOrder,
    subject: (p) => `${p.needsReview ? "[Review needed] " : ""}New order ${p.order.number}`,
    stream: "orders",
  }),
  "order-processing": define({
    component: OrderProcessing,
    subject: (p) => `We are preparing order ${p.order.number}`,
    stream: "orders",
  }),
  "order-shipped": define({
    component: OrderShipped,
    subject: (p) => `Order ${p.order.number} has shipped`,
    stream: "orders",
  }),
  "order-out-for-delivery": define({
    component: OrderOutForDelivery,
    subject: (p) => `Order ${p.order.number} is out for delivery`,
    stream: "orders",
  }),
  "order-delivered-review": define({
    component: OrderDeliveredReview,
    subject: (p) => `Order ${p.order.number} was delivered`,
    stream: "orders",
  }),
  "order-cancelled": define({
    component: OrderCancelled,
    subject: (p) => `Order ${p.order.number} was cancelled`,
    stream: "orders",
  }),
  "newsletter-welcome": define({
    component: NewsletterWelcome,
    subject: () => "Welcome to the Rera Body list",
    stream: "marketing",
  }),
  "settings-test": define({
    component: SettingsTest,
    subject: () => "Test email from your store",
    stream: "orders",
  }),
  "ticket-received": define({
    component: TicketReceived,
    subject: (p) =>
      p.forAdmin
        ? `New message (${p.number}): ${p.subject}`
        : `We received your message (${p.number})`,
    stream: "orders",
  }),
  "ticket-reply": define({
    component: TicketReply,
    subject: (p) => `Re: your message (${p.number})`,
    stream: "orders",
  }),
  "staff-invite": define({
    component: StaffInvite,
    subject: () => "You are invited to the Rera Body admin",
    stream: "orders",
  }),
  "low-stock": define({
    component: LowStock,
    subject: (p) =>
      `Low stock: ${p.productName}${p.variantLabel !== "Default" ? ` (${p.variantLabel})` : ""}`,
    stream: "orders",
  }),
  "order-refunded": define({
    component: OrderRefunded,
    subject: (p) => `Refund for order ${p.order.number}`,
    stream: "orders",
  }),
};

export type EmailTemplateName = keyof typeof emailTemplates;
export type EmailTemplateProps<T extends EmailTemplateName> =
  (typeof emailTemplates)[T] extends TemplateDef<infer P> ? P : never;
