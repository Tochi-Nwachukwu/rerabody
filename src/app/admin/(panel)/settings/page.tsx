import type { Metadata } from "next";

import { PageHeader } from "@/components/admin/page-header";
import { SettingsForms } from "@/components/admin/settings/settings-forms";
import { env } from "@/env";
import { parseAllSettings } from "@/lib/settings";
import { requirePagePermission } from "@/server/auth/session";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Settings" };

// A28
export default async function SettingsPage() {
  await requirePagePermission("settings.manage");
  const [rows, methods] = await Promise.all([
    db.siteSetting.findMany(),
    db.shippingMethod.findMany({ orderBy: { price: "asc" } }),
  ]);
  const settings = parseAllSettings(rows);
  const logo = settings.store.logoMediaId
    ? await db.media.findUnique({
        where: { id: settings.store.logoMediaId },
        select: { id: true, url: true, alt: true },
      })
    : null;
  return (
    <>
      <PageHeader title="Settings" />
      <SettingsForms
        settings={settings}
        logo={logo}
        currency={env.STORE_CURRENCY}
        methods={methods.map((m) => ({
          id: m.id,
          name: m.name,
          price: m.price,
          region: m.region ?? "",
          estimate: m.estimate ?? "",
          isActive: m.isActive,
        }))}
      />
    </>
  );
}
