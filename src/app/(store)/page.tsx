import type { Metadata } from "next";

import { HomeSections } from "@/components/store/home/sections";
import { env } from "@/env";
import { getPublishedHomeSections } from "@/server/queries/home";
import { getSiteSettings } from "@/server/queries/settings";

export async function generateMetadata(): Promise<Metadata> {
  const { seo } = await getSiteSettings();
  return {
    title: { absolute: seo.defaultTitle },
    description: seo.defaultDescription || undefined,
    alternates: { canonical: "/" },
  };
}

// S1 homepage: published sections only, in order. Cached under the "home" tag.
export default async function HomePage() {
  const sections = await getPublishedHomeSections();
  return <HomeSections sections={sections} currency={env.STORE_CURRENCY} />;
}
