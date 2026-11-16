import { Badge } from "@/components/ui/badge";

const LABELS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  DRAFT: { label: "Draft", variant: "outline" },
  PUBLISHED: { label: "Published", variant: "default" },
  ARCHIVED: { label: "Archived", variant: "secondary" },
  PENDING_PAYMENT: { label: "Pending payment", variant: "outline" },
  PAID: { label: "Paid", variant: "default" },
  PROCESSING: { label: "Processing", variant: "default" },
  SHIPPED: { label: "Shipped", variant: "default" },
  OUT_FOR_DELIVERY: { label: "Out for delivery", variant: "default" },
  DELIVERED: { label: "Delivered", variant: "secondary" },
  CANCELLED: { label: "Cancelled", variant: "destructive" },
  REFUNDED: { label: "Refunded", variant: "destructive" },
  PENDING: { label: "Pending", variant: "outline" },
  APPROVED: { label: "Approved", variant: "default" },
  REJECTED: { label: "Rejected", variant: "destructive" },
  OPEN: { label: "Open", variant: "default" },
  CLOSED: { label: "Closed", variant: "secondary" },
  ACTIVE: { label: "Active", variant: "default" },
  INVITED: { label: "Invited", variant: "outline" },
  DEACTIVATED: { label: "Deactivated", variant: "destructive" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = LABELS[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export function statusLabel(status: string) {
  return LABELS[status]?.label ?? status;
}
