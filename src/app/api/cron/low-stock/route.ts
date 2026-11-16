import { NextResponse } from "next/server";

import { env } from "@/env";
import { absoluteUrl } from "@/lib/site";
import { variantLabel } from "@/lib/variants";
import { isAuthorisedCron } from "@/server/cron";
import { db } from "@/server/db";
import { sendEmail } from "@/server/email";
import { getSiteSettings } from "@/server/queries/settings";
import { findLowStockVariants } from "@/server/services/low-stock";

/** Daily low stock alert. One email per variant per day (dedupe `low-stock:{variantId}:{date}`). */
export async function GET(request: Request) {
  if (!isAuthorisedCron(request.headers, env.CRON_SECRET))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const settings = await getSiteSettings();
  const to = settings.notifications.adminAlertEmail;
  const variants = await findLowStockVariants(db);
  if (!to)
    return NextResponse.json({
      lowStock: variants.length,
      sent: 0,
      note: "No admin alert email set",
    });

  const date = new Date().toISOString().slice(0, 10);
  let sent = 0;
  for (const v of variants) {
    const res = await sendEmail({
      template: "low-stock",
      to,
      dedupeKey: `low-stock:${v.id}:${date}`,
      props: {
        productName: v.product.name,
        variantLabel: variantLabel(v.optionValues as Record<string, string>),
        sku: v.sku,
        stock: v.stock,
        threshold: v.lowStockThreshold,
        adminUrl: absoluteUrl(`/admin/inventory?q=${encodeURIComponent(v.sku)}`),
      },
    });
    if (res.status === "sent") sent++;
  }
  return NextResponse.json({ lowStock: variants.length, sent });
}
