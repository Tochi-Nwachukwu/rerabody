import { Button, Heading, Text } from "@react-email/components";

import { STORE_NAME, absoluteUrl } from "@/lib/site";

import { EmailLayout, button, heading, text } from "./components/layout";

export type NewsletterWelcomeProps = { unsubscribeUrl: string };

export default function NewsletterWelcome({ unsubscribeUrl }: NewsletterWelcomeProps) {
  return (
    <EmailLayout preview={`You are on the ${STORE_NAME} list`} unsubscribeUrl={unsubscribeUrl}>
      <Heading style={heading}>You are on the list</Heading>
      <Text style={text}>
        Thank you for signing up. We will send you news about new products and offers. No more than
        we need to.
      </Text>
      <Button href={absoluteUrl("/shop")} style={button}>
        Visit the store
      </Button>
    </EmailLayout>
  );
}

NewsletterWelcome.PreviewProps = { unsubscribeUrl: "http://localhost:3000/unsubscribe" };
