/**
 * Replaces leftover placeholder text in an existing database with the copy in prisma/content.ts.
 * Only fields that still contain placeholder text are changed, so edits made in the admin stay.
 *
 *   pnpm exec tsx prisma/apply-content.ts            # uses DIRECT_URL or DATABASE_URL
 *   DATABASE_URL=... pnpm exec tsx prisma/apply-content.ts
 *
 * Pages are cached; after running this against production, redeploy (or save any section in
 * the admin) so the storefront picks up the new text.
 */
import "dotenv/config";

import { Prisma } from "../src/generated/prisma/client";
import { type SectionType, sectionSchemas } from "../src/lib/home-sections";
import { createPrismaClient } from "../src/server/prisma";
import {
  COLLECTION_COPY,
  CATEGORY_COPY,
  FAQ_COPY,
  HOME_COPY,
  PAGE_COPY,
  PRODUCT_COPY,
  SEO_DESCRIPTION,
  SHIPPING_METHODS,
} from "./content";

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("Set DIRECT_URL or DATABASE_URL");
const prisma = createPrismaClient(url);

const isPlaceholder = (v: unknown) => /placeholder|example\.com/i.test(JSON.stringify(v ?? ""));
const log: string[] = [];

async function catalogue() {
  for (const c of await prisma.category.findMany()) {
    if (CATEGORY_COPY[c.slug] && (c.description === null || isPlaceholder(c.description))) {
      await prisma.category.update({
        where: { id: c.id },
        data: { description: CATEGORY_COPY[c.slug] },
      });
      log.push(`category ${c.slug}`);
    }
  }
  for (const c of await prisma.collection.findMany()) {
    if (COLLECTION_COPY[c.slug] && (c.description === null || isPlaceholder(c.description))) {
      await prisma.collection.update({
        where: { id: c.id },
        data: { description: COLLECTION_COPY[c.slug] },
      });
      log.push(`collection ${c.slug}`);
    }
  }
  for (const p of await prisma.product.findMany()) {
    const copy = PRODUCT_COPY[p.slug];
    if (!copy) continue;
    const data: Prisma.ProductUpdateInput = {};
    if (isPlaceholder(p.description)) data.description = copy.description;
    if (isPlaceholder(p.specs)) data.specs = copy.specs;
    if (isPlaceholder(p.sizeGuide)) data.sizeGuide = copy.sizeGuide ?? Prisma.DbNull;
    if (isPlaceholder(p.metaDescription)) data.metaDescription = copy.metaDescription;
    if (Object.keys(data).length) {
      await prisma.product.update({ where: { id: p.id }, data });
      log.push(`product ${p.slug}: ${Object.keys(data).join(", ")}`);
    }
  }
  for (const m of await prisma.shippingMethod.findMany()) {
    if (!isPlaceholder(m.name)) continue;
    const real = SHIPPING_METHODS.find((s) => m.name.startsWith(s.name));
    if (!real) continue;
    await prisma.shippingMethod.update({
      where: { id: m.id },
      data: { name: real.name, region: real.region, estimate: real.estimate },
    });
    log.push(`shipping ${real.name}`);
  }
}

async function homepage() {
  const cover = async (slug: string) =>
    (await prisma.media.findUnique({ where: { key: `static/products/${slug}.webp` } }))?.id ?? null;
  const products = new Map(
    (await prisma.product.findMany({ select: { id: true, slug: true } })).map((p) => [
      p.id,
      p.slug,
    ]),
  );

  for (const s of await prisma.homeSection.findMany()) {
    if (!isPlaceholder(s.data)) continue;
    const d = { ...(s.data as Record<string, unknown>) };
    switch (s.type) {
      case "HERO":
        Object.assign(d, HOME_COPY.hero);
        break;
      case "TICKER":
        d.items = HOME_COPY.ticker;
        break;
      case "STEPS":
        Object.assign(d, HOME_COPY.steps);
        break;
      case "NEWSLETTER":
        Object.assign(d, HOME_COPY.newsletter);
        break;
      case "FEATURED_PRODUCT": {
        const copy = HOME_COPY.featured[products.get(d.productId as string) ?? ""];
        if (copy) Object.assign(d, copy);
        break;
      }
      case "TEXT_IMAGE":
        if (d.heading === "Why Rera") {
          Object.assign(d, HOME_COPY.why);
          d.imageId ??= await cover("cranberry-fig-lavender-body-butter");
        } else if (d.heading === "Shop all") {
          Object.assign(d, HOME_COPY.shopAll);
          d.imageId ??= await cover("mustard-botanical-robe");
          d.imagePosition = "left";
        } else if (
          d.heading === "Our story" ||
          d.heading === "About Rera" ||
          d.heading === "Your skin, but better."
        ) {
          Object.assign(d, HOME_COPY.about);
          d.imageId ??= await cover("true-blue-body-butter");
        }
        break;
    }
    // Throws if the new data does not fit the section schema.
    const data = sectionSchemas[s.type as SectionType].parse(d) as Prisma.InputJsonValue;
    await prisma.homeSection.update({ where: { id: s.id }, data: { data } });
    log.push(`home ${s.type}${d.heading ? ` (${d.heading as string})` : ""}`);
  }
}

async function pagesAndFaq() {
  for (const [slug, p] of Object.entries(PAGE_COPY)) {
    const page = await prisma.page.findUnique({ where: { slug } });
    if (!page || !isPlaceholder(page.body)) continue;
    await prisma.page.update({
      where: { slug },
      data: { body: p.body, draftBody: Prisma.DbNull, metaDescription: p.metaDescription },
    });
    log.push(`page ${slug}`);
  }
  for (const f of await prisma.faq.findMany()) {
    const copy = FAQ_COPY.find((c) => c.question === f.question);
    if (copy && isPlaceholder(f.answer)) {
      await prisma.faq.update({ where: { id: f.id }, data: { answer: copy.answer } });
      log.push(`faq ${f.question}`);
    }
  }
}

async function settings() {
  const store = await prisma.siteSetting.findUnique({ where: { key: "store" } });
  const sv = store?.value as Record<string, unknown> | undefined;
  if (sv && isPlaceholder(sv.contactEmail)) {
    await prisma.siteSetting.update({
      where: { key: "store" },
      data: { value: { ...sv, contactEmail: "" } },
    });
    log.push("settings store.contactEmail cleared");
  }
  const seo = await prisma.siteSetting.findUnique({ where: { key: "seo" } });
  const seov = seo?.value as Record<string, unknown> | undefined;
  if (seov && isPlaceholder(seov.defaultDescription)) {
    await prisma.siteSetting.update({
      where: { key: "seo" },
      data: { value: { ...seov, defaultDescription: SEO_DESCRIPTION } },
    });
    log.push("settings seo.defaultDescription");
  }
}

async function main() {
  await catalogue();
  await homepage();
  await pagesAndFaq();
  await settings();
  console.log(log.length ? log.join("\n") : "Nothing to change.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
