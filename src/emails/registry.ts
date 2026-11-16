import type { ComponentType } from "react";

import PasswordReset from "./password-reset";
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
};

export type EmailTemplateName = keyof typeof emailTemplates;
export type EmailTemplateProps<T extends EmailTemplateName> =
  (typeof emailTemplates)[T] extends TemplateDef<infer P> ? P : never;
