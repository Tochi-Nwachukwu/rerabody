import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { parseAllSettings, type SiteSettings } from "@/lib/settings";
import { TAGS } from "@/server/cache-tags";
import { db } from "@/server/db";

export async function getSiteSettings(): Promise<SiteSettings> {
  "use cache";
  cacheTag(TAGS.settings);
  cacheLife("max");
  const rows = await db.siteSetting.findMany();
  return parseAllSettings(rows);
}
