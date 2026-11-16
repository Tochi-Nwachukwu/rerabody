import "server-only";

import { TAGS, expireTags } from "@/server/cache-tags";
import type { WebhookOutcome } from "@/server/services/payment-webhook";

/**
 * Side effects that run after a payment transaction commits: cache
 * invalidation now, emails in Phase 5. Never call inside a transaction.
 */
export async function afterPaymentOutcome(outcome: WebhookOutcome) {
  if (outcome.status === "paid") {
    expireTags(TAGS.products, ...outcome.productIds.map(TAGS.product));
  }
}
