import { z } from "zod";

/** Typed SiteSetting values. Each key parses with defaults so a missing or bad row never breaks a page. */

const link = z.object({ label: z.string().min(1).max(60), href: z.string().min(1).max(300) });

export const settingSchemas = {
  store: z.object({
    name: z.string().min(1).max(80).default("Rera Body"),
    contactEmail: z.string().max(200).default(""),
    contactPhone: z.string().max(40).default(""),
    address: z.string().max(300).default(""),
    logoMediaId: z.string().nullable().default(null),
  }),
  social: z.object({
    instagram: z.string().max(300).default(""),
    tiktok: z.string().max(300).default(""),
    facebook: z.string().max(300).default(""),
  }),
  footer: z.object({
    columns: z
      .array(z.object({ title: z.string().min(1).max(40), links: z.array(link).max(12) }))
      .max(4)
      .default([]),
    note: z.string().max(300).default(""),
  }),
  notifications: z.object({
    adminAlertEmail: z.string().max(200).default(""),
    defaultLowStockThreshold: z.number().int().min(0).max(10000).default(5),
  }),
  seo: z.object({
    defaultTitle: z.string().max(70).default("Rera Body"),
    defaultDescription: z.string().max(170).default(""),
  }),
  tracking: z.object({
    // urlPattern uses {tracking} as the placeholder, e.g. https://carrier.example/track/{tracking}
    carriers: z
      .array(z.object({ name: z.string().min(1).max(60), urlPattern: z.string().max(300) }))
      .max(20)
      .default([]),
  }),
  // Chat widget embed, switched on without a deploy. Only known providers, so the CSP can allow them.
  chatWidget: z.object({
    enabled: z.boolean().default(false),
    provider: z.enum(["tawk", "crisp"]).default("tawk"),
    // Tawk.to: "propertyId/widgetId". Crisp: the website id.
    siteId: z
      .string()
      .trim()
      .max(100)
      .regex(/^[A-Za-z0-9/_-]*$/, "Use the id from the provider's embed code")
      .default(""),
  }),
} as const;

export type SettingKey = keyof typeof settingSchemas;
export type SiteSettings = { [K in SettingKey]: z.output<(typeof settingSchemas)[K]> };

export function parseSetting<K extends SettingKey>(key: K, value: unknown): SiteSettings[K] {
  const schema = settingSchemas[key];
  const parsed = schema.safeParse(value ?? {});
  return (parsed.success ? parsed.data : schema.parse({})) as SiteSettings[K];
}

export function parseAllSettings(rows: { key: string; value: unknown }[]): SiteSettings {
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return Object.fromEntries(
    (Object.keys(settingSchemas) as SettingKey[]).map((k) => [k, parseSetting(k, map.get(k))]),
  ) as SiteSettings;
}

export function trackingUrl(
  settings: SiteSettings["tracking"],
  carrier: string | null,
  number: string | null,
): string | null {
  if (!carrier || !number) return null;
  const match = settings.carriers.find((c) => c.name.toLowerCase() === carrier.toLowerCase());
  if (!match?.urlPattern) return null;
  return match.urlPattern.replace("{tracking}", encodeURIComponent(number));
}
