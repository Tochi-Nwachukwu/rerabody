import { Button, Heading, Text } from "@react-email/components";

import { STORE_NAME, absoluteUrl } from "@/lib/site";

import { EmailLayout, button, heading, text } from "./components/layout";

export type WelcomeProps = { name: string };

export default function Welcome({ name }: WelcomeProps) {
  return (
    <EmailLayout preview={`Welcome to ${STORE_NAME}`}>
      <Heading style={heading}>Welcome, {name}</Heading>
      <Text style={text}>
        Your email is confirmed and your account is ready. You can track orders, save addresses and
        leave reviews from your account.
      </Text>
      <Button href={absoluteUrl("/shop")} style={button}>
        Start shopping
      </Button>
    </EmailLayout>
  );
}

Welcome.PreviewProps = { name: "Ada" };
