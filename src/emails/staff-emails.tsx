import { Button, Heading, Link, Text } from "@react-email/components";

import { STORE_NAME } from "@/lib/site";

import { EmailLayout, button, colors, heading, mutedText, text } from "./components/layout";

export function StaffInvite({
  invitedBy,
  roleName,
  url,
}: {
  invitedBy: string;
  roleName: string;
  url: string;
}) {
  return (
    <EmailLayout preview={`You are invited to the ${STORE_NAME} admin`}>
      <Heading style={heading}>You are invited</Heading>
      <Text style={text}>
        {invitedBy} invited you to help run {STORE_NAME} as {roleName}.
      </Text>
      <Button href={url} style={button}>
        Accept the invitation
      </Button>
      <Text style={{ ...mutedText, marginTop: "24px" }}>
        The link works for 7 days. If you were not expecting this, you can ignore it.
      </Text>
    </EmailLayout>
  );
}
StaffInvite.PreviewProps = {
  invitedBy: "Store owner",
  roleName: "Fulfilment staff",
  url: "http://localhost:3000/admin/accept-invite",
};

export function LowStock({
  productName,
  variantLabel,
  sku,
  stock,
  threshold,
  adminUrl,
}: {
  productName: string;
  variantLabel: string;
  sku: string;
  stock: number;
  threshold: number;
  adminUrl: string;
}) {
  return (
    <EmailLayout preview={`Low stock: ${productName}`}>
      <Heading style={heading}>Low stock</Heading>
      <Text style={text}>
        {productName}
        {variantLabel !== "Default" ? ` (${variantLabel})` : ""} has {stock} left. The alert level
        is {threshold}.
      </Text>
      <Text style={mutedText}>SKU {sku}</Text>
      <Text style={text}>
        <Link href={adminUrl} style={{ color: colors.primary, fontWeight: 600 }}>
          Open inventory
        </Link>
      </Text>
    </EmailLayout>
  );
}
LowStock.PreviewProps = {
  productName: "Vanilla Body Butter",
  variantLabel: "16 oz",
  sku: "BB-VAN-16",
  stock: 2,
  threshold: 5,
  adminUrl: "http://localhost:3000/admin/inventory",
};
