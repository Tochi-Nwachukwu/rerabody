import { Heading, Text } from "@react-email/components";

import { EmailLayout, heading, text } from "./components/layout";

export default function SettingsTest({ sentBy }: { sentBy: string }) {
  return (
    <EmailLayout preview="Test email">
      <Heading style={heading}>Test email</Heading>
      <Text style={text}>
        This is a test email sent from the store settings by {sentBy}. If you can read this, email
        sending works.
      </Text>
    </EmailLayout>
  );
}

SettingsTest.PreviewProps = { sentBy: "Store owner" };
