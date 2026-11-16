import "server-only";

import { TAGS, expireTags } from "@/server/cache-tags";
import { notifyOrderStatus } from "@/server/notifications/orders";
import type { WebhookOutcome } from "@/server/services/payment-webhook";

/**
 * Side effects that run after a payment transaction commits: cache
 * invalidation and emails (rule 6). Never call inside a transaction.
 */
export async function afterPaymentOutcome(outcome: WebhookOutcome) {
  if (outcome.status === "paid") {
    expireTags(TAGS.products, ...outcome.productIds.map(TAGS.product));
    await notifyOrderStatus(outcome.orderId, "PAID").catch((e) =>
      console.error("[email] order paid notification failed", e),
    );
  } else if (outcome.status === "cancelled") {
    await notifyOrderStatus(outcome.orderId, "CANCELLED").catch((e) =>
      console.error("[email] order cancelled notification failed", e),
    );
  }
}
