import { Button, Heading, Text } from "@react-email/components";

import { EmailLayout, button, heading, mutedText, text } from "./components/layout";

export type VerifyEmailProps = { name: string; url: string };

export default function VerifyEmail({ name, url }: VerifyEmailProps) {
  return (
    <EmailLayout preview="Confirm your email address">
      <Heading style={heading}>Confirm your email</Heading>
      <Text style={text}>Hi {name},</Text>
      <Text style={text}>Please confirm your email address to finish creating your account.</Text>
      <Button href={url} style={button}>
        Confirm email
      </Button>
      <Text style={{ ...mutedText, marginTop: "24px" }}>
        If you did not create an account, you can ignore this email.
      </Text>
    </EmailLayout>
  );
}

VerifyEmail.PreviewProps = {
  name: "Ada",
  url: "http://localhost:3000/api/auth/verify-email?token=x",
};
