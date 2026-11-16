import { absoluteUrl } from "@/lib/site";
import { signValue } from "@/server/signed-links";

/** Signed one-click unsubscribe link for marketing emails (S30). */
export function unsubscribeUrl(subscriberId: string) {
  return absoluteUrl(
    `/unsubscribe?s=${subscriberId}&sig=${encodeURIComponent(signValue("unsubscribe", subscriberId, null))}`,
  );
}
