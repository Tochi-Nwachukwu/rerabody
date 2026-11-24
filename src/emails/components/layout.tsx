import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

import { STORE_NAME, absoluteUrl } from "@/lib/site";

// Placeholder brand colours, matching the storefront theme tokens.
export const colors = {
  background: "#faf7f2",
  card: "#ffffff",
  text: "#3b2f27",
  muted: "#7a6a5d",
  primary: "#5a4335",
  border: "#e9e1d6",
};

export const text = {
  color: colors.text,
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 16px",
};
export const mutedText = { ...text, color: colors.muted, fontSize: "13px", lineHeight: "20px" };
export const heading = {
  color: colors.text,
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "26px",
  lineHeight: "32px",
  fontWeight: 500,
  margin: "0 0 16px",
};
export const button = {
  backgroundColor: colors.primary,
  borderRadius: "6px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "15px",
  fontWeight: 600,
  padding: "12px 22px",
  textDecoration: "none",
};

export function EmailLayout({
  preview,
  children,
  unsubscribeUrl,
}: {
  preview: string;
  children: ReactNode;
  /** Marketing emails must pass this. Order emails do not need it. */
  unsubscribeUrl?: string;
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: colors.background,
          fontFamily: "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
          margin: 0,
          padding: "24px 0",
        }}
      >
        <Container style={{ maxWidth: "560px", margin: "0 auto", padding: "0 16px" }}>
          <Section style={{ textAlign: "center", padding: "0 0 16px" }}>
            <Img
              src={absoluteUrl("/brand/rera-body-logo-email.png")}
              alt={STORE_NAME}
              width="160"
              height="57"
              style={{ margin: "0 auto" }}
            />
          </Section>
          <Section
            style={{
              backgroundColor: colors.card,
              border: `1px solid ${colors.border}`,
              borderRadius: "10px",
              padding: "28px 24px",
            }}
          >
            {children}
          </Section>
          <Hr style={{ borderColor: colors.border, margin: "24px 0 12px" }} />
          <Text style={{ ...mutedText, textAlign: "center" }}>
            {STORE_NAME} ·{" "}
            <Link href={absoluteUrl("/")} style={{ color: colors.muted }}>
              Visit the store
            </Link>
            {" · "}
            <Link href={absoluteUrl("/contact")} style={{ color: colors.muted }}>
              Contact us
            </Link>
          </Text>
          {unsubscribeUrl ? (
            <Text style={{ ...mutedText, textAlign: "center" }}>
              You are receiving this because you signed up for emails from {STORE_NAME}.{" "}
              <Link href={unsubscribeUrl} style={{ color: colors.muted }}>
                Unsubscribe
              </Link>
            </Text>
          ) : null}
        </Container>
      </Body>
    </Html>
  );
}
