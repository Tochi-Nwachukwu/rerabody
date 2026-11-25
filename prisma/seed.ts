/**
 * Rera Body seed script.
 *
 * Product names, sizes and photos are Rera Body's own. Store copy lives in
 * prisma/content.ts. Prices, stock and shipping rates are still placeholders
 * (see docs/decisions.md, "Store copy").
 *
 * Safe to run more than once: catalogue rows are upserted by slug or SKU,
 * and content tables (homepage sections, FAQ) are only filled when empty.
 *
 * Homepage section data is validated against the schemas in src/lib/home-sections.ts.
 */
import "dotenv/config";

import { hashPassword } from "better-auth/crypto";
import { z } from "zod";

import { Prisma } from "../src/generated/prisma/client";
import { type SectionType, sectionSchemas } from "../src/lib/home-sections";
import { createPrismaClient } from "../src/server/prisma";
import { DEFAULT_ROLE_PERMISSIONS, OWNER_ROLE_NAME } from "../src/server/permissions";
import {
  CATEGORY_COPY,
  COLLECTION_COPY,
  FAQ_COPY,
  HOME_COPY,
  PAGE_COPY,
  PRODUCT_COPY,
  SEO_DESCRIPTION,
  SEO_TITLE,
  SHIPPING_METHODS,
} from "./content";

const seedEnv = z
  .object({
    DIRECT_URL: z.url().optional(),
    DATABASE_URL: z.url(),
    SEED_OWNER_EMAIL: z.email(),
    SEED_OWNER_PASSWORD: z.string().min(12),
  })
  .parse(process.env);

const prisma = createPrismaClient(seedEnv.DIRECT_URL ?? seedEnv.DATABASE_URL);

// ---------------------------------------------------------------------------
// Roles, permissions and the owner account
// ---------------------------------------------------------------------------

async function seedRoles() {
  const roles: Record<string, string> = {};
  for (const [name, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name, isSystem: name === OWNER_ROLE_NAME },
    });
    roles[name] = role.id;

    // The Owner always holds every permission. Other roles only get defaults
    // on first seed so edits made in the admin are not overwritten.
    const existing = await prisma.rolePermission.count({ where: { roleId: role.id } });
    if (name === OWNER_ROLE_NAME || existing === 0) {
      await prisma.rolePermission.createMany({
        data: permissions.map((permission) => ({ roleId: role.id, permission })),
        skipDuplicates: true,
      });
    }
  }
  return roles;
}

async function seedOwner(ownerRoleId: string) {
  const email = seedEnv.SEED_OWNER_EMAIL.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.roleId !== ownerRoleId) {
      await prisma.user.update({ where: { id: existing.id }, data: { roleId: ownerRoleId } });
    }
    return existing;
  }

  const password = await hashPassword(seedEnv.SEED_OWNER_PASSWORD);
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        name: "Store owner",
        emailVerified: true,
        status: "ACTIVE",
        roleId: ownerRoleId,
      },
    });
    // Better Auth stores email and password sign-in as a "credential" account whose
    // accountId is the user id (matches better-auth sign-up).
    await tx.account.create({
      data: { userId: user.id, providerId: "credential", accountId: user.id, password },
    });
    return user;
  });
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { slug: "body-butters", name: "Body Butters", position: 0 },
  { slug: "loungewear", name: "Loungewear", position: 1 },
] as const;

const COLLECTIONS = [
  { slug: "body-butters", name: "Body Butters", position: 0 },
  { slug: "loungewear", name: "Loungewear", position: 1 },
  { slug: "gift-sets", name: "Gift Sets", position: 2 },
] as const;

type SeedVariant = {
  sku: string;
  optionValues: Record<string, string>;
  price: number; // minor units, placeholder
  compareAtPrice?: number;
  stock: number;
};

type SeedProduct = {
  slug: string;
  name: string;
  category: (typeof CATEGORIES)[number]["slug"];
  collections: (typeof COLLECTIONS)[number]["slug"][];
  options: { name: string; values: string[] }[];
  variants: SeedVariant[];
  /** Defaults to PUBLISHED. */
  status?: "DRAFT" | "PUBLISHED";
};

// Real product photos, served from public/products/ (optimised WebP).
const PRODUCT_PHOTOS: Record<
  string,
  { width: number; height: number; bytes: number; alt: string }
> = {
  "vanilla-body-butter": {
    width: 1441,
    height: 2000,
    bytes: 132150,
    alt: "Rera Vanilla body butter, 16 oz jar with a gold label, among dried roses",
  },
  "lemon-dream-body-butter": {
    width: 2000,
    height: 1739,
    bytes: 201460,
    alt: "Rera Lemon Dream body butter, 16 oz jar on a wooden slab with lemons and almonds",
  },
  "cranberry-fig-lavender-body-butter": {
    width: 2000,
    height: 1095,
    bytes: 164320,
    alt: "Rera Cranberry Fig + Lavender body butter, 16 oz jar among dried grasses and seed pods",
  },
  "true-blue-body-butter": {
    width: 1351,
    height: 2000,
    bytes: 114250,
    alt: "Rera True Blue body butter, 8 oz jar with a blue label, resting in rippling water",
  },
  "purple-geo-robe": {
    width: 1324,
    height: 2000,
    bytes: 287500,
    alt: "Model in the Purple Geo robe, a long navy wrap robe with a lilac geometric print, holding a mug",
  },
  "green-leaf-robe": {
    width: 1333,
    height: 2000,
    bytes: 218772,
    alt: "Model in the Green Leaf robe, a long deep green wrap robe with a white leaf print, holding a mug",
  },
  "mustard-botanical-robe": {
    width: 1333,
    height: 2000,
    bytes: 230648,
    alt: "Model in the Mustard Botanical robe, a long mustard wrap robe with a white botanical print, holding a mug",
  },
};

function butter(
  slug: string,
  name: string,
  sku: string,
  // Sizes from the product labels: 3 oz, 8 oz and 16 oz jars. Prices are placeholders.
  prices: [number, number, number],
  stock: [number, number, number],
): SeedProduct {
  return {
    slug,
    name,
    category: "body-butters",
    collections: ["body-butters"],
    options: [{ name: "Size", values: ["3 oz", "8 oz", "16 oz"] }],
    variants: [
      { sku: `${sku}-3`, optionValues: { Size: "3 oz" }, price: prices[0], stock: stock[0] },
      { sku: `${sku}-8`, optionValues: { Size: "8 oz" }, price: prices[1], stock: stock[1] },
      { sku: `${sku}-16`, optionValues: { Size: "16 oz" }, price: prices[2], stock: stock[2] },
    ],
  };
}

function loungewear(
  slug: string,
  name: string,
  sku: string,
  // Most pieces are free size. Price and stock are placeholders.
  price: number,
  stock: number,
): SeedProduct {
  return {
    slug,
    name,
    category: "loungewear",
    collections: ["loungewear"],
    options: [{ name: "Size", values: ["Free size"] }],
    variants: [{ sku: `${sku}-FS`, optionValues: { Size: "Free size" }, price, stock }],
  };
}

const PRODUCTS: SeedProduct[] = [
  butter("vanilla-body-butter", "Vanilla Body Butter", "BB-VAN", [900, 1800, 2900], [30, 40, 25]),
  butter(
    "lemon-dream-body-butter",
    "Lemon Dream Body Butter",
    "BB-LEM",
    [900, 1800, 2900],
    [20, 30, 3],
  ),
  butter(
    "cranberry-fig-lavender-body-butter",
    "Cranberry Fig + Lavender Body Butter",
    "BB-CFL",
    [800, 1600, 2600],
    [30, 50, 20],
  ),
  {
    ...butter(
      "true-blue-body-butter",
      "True Blue Body Butter",
      "BB-TRB",
      [1000, 2000, 3200],
      [15, 0, 12],
    ),
    collections: ["body-butters", "gift-sets"],
  },
  loungewear("purple-geo-robe", "Purple Geo Robe", "LW-PGEO", 5800, 12),
  {
    ...loungewear("green-leaf-robe", "Green Leaf Robe", "LW-GLEAF", 5800, 10),
    collections: ["loungewear", "gift-sets"],
  },
  loungewear("mustard-botanical-robe", "Mustard Botanical Robe", "LW-MBOT", 5800, 8),
  // No photo yet, so it stays a draft until one is added in the admin.
  { ...loungewear("olive-floral-robe", "Olive Floral Robe", "LW-OFLO", 5800, 10), status: "DRAFT" },
];

async function seedCatalogue() {
  const categoryIds: Record<string, string> = {};
  for (const c of CATEGORIES) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: { ...c, description: CATEGORY_COPY[c.slug] },
    });
    categoryIds[c.slug] = row.id;
  }

  const collectionIds: Record<string, string> = {};
  for (const c of COLLECTIONS) {
    const row = await prisma.collection.upsert({
      where: { slug: c.slug },
      update: {},
      create: { ...c, description: COLLECTION_COPY[c.slug] },
    });
    collectionIds[c.slug] = row.id;
  }

  const productIds: Record<string, string> = {};
  for (const p of PRODUCTS) {
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        slug: p.slug,
        name: p.name,
        status: p.status ?? "PUBLISHED",
        categoryId: categoryIds[p.category],
        description: PRODUCT_COPY[p.slug].description,
        specs: PRODUCT_COPY[p.slug].specs,
        sizeGuide: PRODUCT_COPY[p.slug].sizeGuide,
        metaTitle: p.name,
        metaDescription: PRODUCT_COPY[p.slug].metaDescription,
        options: {
          create: p.options.map((o, position) => ({ name: o.name, values: o.values, position })),
        },
      },
    });
    productIds[p.slug] = product.id;

    const photo = PRODUCT_PHOTOS[p.slug];
    if (photo) {
      const key = `static/products/${p.slug}.webp`;
      const media = await prisma.media.upsert({
        where: { key },
        update: {},
        create: { key, url: `/products/${p.slug}.webp`, mimeType: "image/webp", ...photo },
      });
      const linked = await prisma.productImage.findFirst({
        where: { productId: product.id, mediaId: media.id },
      });
      if (!linked) {
        await prisma.productImage.create({
          data: { productId: product.id, mediaId: media.id, position: 0, isCover: true },
        });
      }
    }

    for (const [position, slug] of p.collections.entries()) {
      await prisma.collectionProduct.upsert({
        where: {
          collectionId_productId: { collectionId: collectionIds[slug], productId: product.id },
        },
        update: {},
        create: { collectionId: collectionIds[slug], productId: product.id, position },
      });
    }

    for (const v of p.variants) {
      const existing = await prisma.productVariant.findUnique({ where: { sku: v.sku } });
      if (existing) continue;
      await prisma.productVariant.create({
        data: {
          productId: product.id,
          sku: v.sku,
          optionValues: v.optionValues,
          price: v.price,
          compareAtPrice: v.compareAtPrice,
          stock: v.stock,
          inventoryMovements:
            v.stock > 0
              ? { create: { delta: v.stock, reason: "RESTOCK", note: "Opening stock" } }
              : undefined,
        },
      });
    }
  }

  return { collectionIds, productIds };
}

// ---------------------------------------------------------------------------
// Shipping, content and settings
// ---------------------------------------------------------------------------

async function seedShipping() {
  if ((await prisma.shippingMethod.count()) > 0) return;
  await prisma.shippingMethod.createMany({ data: SHIPPING_METHODS });
}

async function seedHomeSections(
  collectionIds: Record<string, string>,
  productIds: Record<string, string>,
) {
  if ((await prisma.homeSection.count()) > 0) return;

  // Real Rera photos for the hero slideshow, served from public/marketing/.
  const marketing = async (
    file: string,
    width: number,
    height: number,
    bytes: number,
    alt: string,
  ) => {
    const key = `static/marketing/${file}`;
    const media = await prisma.media.upsert({
      where: { key },
      update: {},
      create: { key, url: `/marketing/${file}`, mimeType: "image/webp", width, height, bytes, alt },
    });
    return media.id;
  };
  const heroImageIds = [
    await marketing(
      "rera-body-butters.webp",
      2560,
      1429,
      224712,
      "Rera body butters in Cranberry Fig + Lavender, True Blue, Vanilla and Lemon Dream, on stone and wood with lemons and dried roses",
    ),
    await marketing(
      "rera-robes.webp",
      2553,
      1280,
      372530,
      "Three Rera robes side by side: Purple Geo, Green Leaf and Mustard Botanical",
    ),
    await marketing(
      "rera-gift-set.webp",
      2560,
      1442,
      198758,
      "Rera gift box with a folded Mustard Botanical robe and a jar of Lemon Dream body butter",
    ),
  ];
  // Collection tiles: a product photo for each, and the gift box for Gift sets.
  const coverOf = async (slug: string) =>
    (await prisma.media.findUnique({ where: { key: `static/products/${slug}.webp` } }))?.id ?? null;
  const bannerImages: Record<string, string | null> = {
    "body-butters": await coverOf("lemon-dream-body-butter"),
    loungewear: await coverOf("green-leaf-robe"),
    "gift-sets": heroImageIds[2],
  };

  // Order follows build-plan.md "Homepage sections" (S1). The footer is part of the layout, not a section.
  const sections: {
    type: Prisma.HomeSectionCreateManyInput["type"];
    data: Prisma.InputJsonValue;
  }[] = [
    {
      type: "HERO",
      data: {
        headline: HOME_COPY.hero.headline,
        subheadline: HOME_COPY.hero.subheadline,
        buttonLabel: "Shop now",
        buttonHref: "/shop",
        imageIds: heroImageIds,
        badge: HOME_COPY.hero.badge,
      },
    },
    {
      type: "COLLECTION_BANNERS",
      data: {
        items: ["body-butters", "loungewear", "gift-sets"].map((slug) => ({
          collectionId: collectionIds[slug],
          title: "",
          imageId: bannerImages[slug],
        })),
      },
    },
    {
      type: "PRODUCT_GRID",
      data: {
        title: "Best sellers",
        source: "manual",
        productIds: Object.values(productIds).slice(0, 6),
        limit: 6,
        showCategoryTabs: false,
      },
    },
    {
      type: "TEXT_IMAGE",
      data: {
        ...HOME_COPY.why,
        imageId: await coverOf("cranberry-fig-lavender-body-butter"),
      },
    },
    {
      type: "TICKER",
      data: {
        items: HOME_COPY.ticker,
      },
    },
    {
      type: "FEATURED_PRODUCT",
      data: {
        productId: productIds["vanilla-body-butter"],
        ...HOME_COPY.featured["vanilla-body-butter"],
      },
    },
    {
      type: "FEATURED_PRODUCT",
      data: {
        productId: productIds["purple-geo-robe"],
        ...HOME_COPY.featured["purple-geo-robe"],
      },
    },
    {
      type: "PRODUCT_GRID",
      data: {
        title: "New arrivals",
        source: "newest",
        productIds: [],
        limit: 8,
        showCategoryTabs: true,
      },
    },
    {
      type: "TEXT_IMAGE",
      data: {
        ...HOME_COPY.shopAll,
        buttonLabel: "Shop all",
        buttonHref: "/shop",
        imageId: await coverOf("mustard-botanical-robe"),
        imagePosition: "left",
      },
    },
    {
      type: "TEXT_IMAGE",
      data: { ...HOME_COPY.about, imageId: await coverOf("true-blue-body-butter") },
    },
    {
      type: "STEPS",
      data: {
        ...HOME_COPY.steps,
      },
    },
    {
      type: "TESTIMONIALS",
      data: { heading: "What customers say", limit: 6 },
    },
    {
      type: "NEWSLETTER",
      data: HOME_COPY.newsletter,
    },
  ];

  await prisma.homeSection.createMany({
    data: sections.map((s, position) => ({
      type: s.type,
      position,
      isVisible: true,
      // Throws if the data does not match the section schema.
      data: sectionSchemas[s.type as SectionType].parse(s.data) as Prisma.InputJsonValue,
    })),
  });
}

async function seedPages() {
  for (const [slug, p] of Object.entries(PAGE_COPY)) {
    await prisma.page.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        title: p.title,
        body: p.body,
        metaTitle: p.title,
        metaDescription: p.metaDescription,
        publishedAt: new Date(),
      },
    });
  }
}

async function seedFaqs() {
  if ((await prisma.faq.count()) > 0) return;
  await prisma.faq.createMany({ data: FAQ_COPY.map((f, position) => ({ ...f, position })) });
}

async function seedSettings() {
  const settings: Record<string, Prisma.InputJsonValue> = {
    store: {
      name: "Rera Body",
      // Set the real address in Admin > Settings. Empty hides it on the contact page.
      contactEmail: "",
      contactPhone: "",
      logoMediaId: null,
    },
    social: { instagram: "", tiktok: "", facebook: "" },
    footer: {
      columns: [
        {
          title: "Shop",
          links: [
            { label: "Shop all", href: "/shop" },
            { label: "Body Butters", href: "/collections/body-butters" },
            { label: "Loungewear", href: "/collections/loungewear" },
            { label: "Gift Sets", href: "/collections/gift-sets" },
            { label: "Offers", href: "/offers" },
          ],
        },
        {
          title: "Help",
          links: [
            { label: "FAQ", href: "/faq" },
            { label: "Contact", href: "/contact" },
            { label: "Shipping and returns", href: "/shipping-returns" },
          ],
        },
        {
          title: "About",
          links: [
            { label: "Terms", href: "/terms" },
            { label: "Privacy", href: "/privacy" },
          ],
        },
      ],
    },
    notifications: { adminAlertEmail: "orders-alerts@example.com", defaultLowStockThreshold: 5 },
    seo: { defaultTitle: SEO_TITLE, defaultDescription: SEO_DESCRIPTION },
    tracking: { carriers: [] },
    chatWidget: { enabled: false, provider: "tawk", siteId: "" },
  };

  for (const [key, value] of Object.entries(settings)) {
    await prisma.siteSetting.upsert({ where: { key }, update: {}, create: { key, value } });
  }
}

// ---------------------------------------------------------------------------

async function main() {
  const roles = await seedRoles();
  const owner = await seedOwner(roles[OWNER_ROLE_NAME]);
  const { collectionIds, productIds } = await seedCatalogue();
  await seedShipping();
  await seedHomeSections(collectionIds, productIds);
  await seedPages();
  await seedFaqs();
  await seedSettings();

  console.log(`Seed complete. Owner account: ${owner.email}. Prices and stock are placeholders.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
