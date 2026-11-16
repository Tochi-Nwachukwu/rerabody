import { Button, Heading, Text } from "@react-email/components";

import { EmailLayout, button, heading, mutedText, text } from "./components/layout";

export function TicketReceived({
  name,
  number,
  subject,
  message,
  forAdmin,
  adminUrl,
}: {
  name: string;
  number: string;
  subject: string;
  message: string;
  forAdmin: boolean;
  adminUrl: string | null;
}) {
  return (
    <EmailLayout
      preview={forAdmin ? `New message: ${subject}` : `We received your message (${number})`}
    >
      <Heading style={heading}>
        {forAdmin ? `New message from ${name}` : "We have your message"}
      </Heading>
      {forAdmin ? null : (
        <Text style={text}>
          Hi {name}, thank you for getting in touch. Your reference is {number}. We will reply by
          email as soon as we can.
        </Text>
      )}
      <Text style={{ ...text, fontWeight: 600 }}>{subject}</Text>
      <Text style={{ ...text, whiteSpace: "pre-line" }}>{message}</Text>
      {forAdmin && adminUrl ? (
        <Button href={adminUrl} style={button}>
          Reply in the admin
        </Button>
      ) : (
        <Text style={mutedText}>Reply to this email if you have anything to add.</Text>
      )}
    </EmailLayout>
  );
}
TicketReceived.PreviewProps = {
  name: "Ada",
  number: "T-1001",
  subject: "Question about sizing",
  message: "Hello",
  forAdmin: false,
  adminUrl: null,
};

export function TicketReply({
  name,
  number,
  body,
}: {
  name: string;
  number: string;
  body: string;
}) {
  return (
    <EmailLayout preview={`Reply to ${number}`}>
      <Heading style={heading}>Reply to your message</Heading>
      <Text style={text}>Hi {name},</Text>
      <Text style={{ ...text, whiteSpace: "pre-line" }}>{body}</Text>
      <Text style={mutedText}>
        Reference {number}. Reply to this email to continue the conversation.
      </Text>
    </EmailLayout>
  );
}
TicketReply.PreviewProps = { name: "Ada", number: "T-1001", body: "Thank you for your message." };
