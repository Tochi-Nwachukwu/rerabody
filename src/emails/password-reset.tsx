import { Button, Heading, Text } from "@react-email/components";

import { EmailLayout, button, heading, mutedText, text } from "./components/layout";

export type PasswordResetProps = { name: string; url: string };

export default function PasswordReset({ name, url }: PasswordResetProps) {
  return (
    <EmailLayout preview="Reset your password">
      <Heading style={heading}>Reset your password</Heading>
      <Text style={text}>Hi {name},</Text>
      <Text style={text}>
        We received a request to reset your password. The link below works for one hour.
      </Text>
      <Button href={url} style={button}>
        Choose a new password
      </Button>
      <Text style={{ ...mutedText, marginTop: "24px" }}>
        If you did not ask for this, you can ignore this email. Your password will not change.
      </Text>
    </EmailLayout>
  );
}

PasswordReset.PreviewProps = { name: "Ada", url: "http://localhost:3000/reset-password?token=x" };
