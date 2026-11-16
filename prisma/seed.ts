/**
 * Rera Body seed script.
 *
 * ============================================================================
 * PLACEHOLDER CONTENT. Every product name, description, price, stock level,
 * shipping rate, homepage text, policy page, FAQ answer and setting below is
 * invented for development. None of it is real Rera Body copy, pricing or
 * policy. Replace all of it with the client's real content before launch.
 * ============================================================================
 *
 * Safe to run more than once: catalogue rows are upserted by slug or SKU,
 * and content tables (homepage sections, FAQ) are only filled when empty.
 *
 * Homepage section `data` shapes are provisional until the Zod schemas for
 * each section type are written in Phase 6.
 */
import "dotenv/config";

import { hashPassword } from "better-auth/crypto";
import { z } from "zod";

import { Prisma } from "../src/generated/prisma/client";
import { createPrismaClient } from "../src/server/prisma";
import { DEFAULT_ROLE_PERMISSIONS, OWNER_ROLE_NAME } from "../src/server/permissions";

const seedEnv = z
  .object({
    DIRECT_URL: z.url().optional(),
    DATABASE_URL: z.url(),
    SEED_OWNER_EMAIL: z.email(),
    SEED_OWNER_PASSWORD: z.string().min(12),
  })
  .parse(process.env);

const prisma = createPrismaClient(seedEnv.DIRECT_URL ?? seedEnv.DATABASE_URL);

const PLACEHOLDER_NOTE = "Placeholder text. Replace with real Rera Body copy before launch.";

/** Minimal Tiptap document made of paragraphs. */
function doc(...paragraphs: string[]): Prisma.InputJsonValue {
  return {
    type: "doc",
    content: paragraphs.map((text) => ({
      type: "paragraph",
      content: [{ type: "text", text }],
    })),
  };
}

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
  { slug: "nightwear", name: "Nightwear", position: 1 },
] as const;

const COLLECTIONS = [
  { slug: "body-butters", name: "Body Butters", position: 0 },
  { slug: "nightwear", name: "Nightwear", position: 1 },
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
};

function butter(
  slug: string,
  name: string,
  sku: string,
  prices: [number, number],
  stock: [number, number],
): SeedProduct {
  return {
    slug,
    name,
    category: "body-butters",
    collections: ["body-butters"],
    options: [{ name: "Size", values: ["100 ml", "200 ml"] }],
    variants: [
      { sku: `${sku}-100`, optionValues: { Size: "100 ml" }, price: prices[0], stock: stock[0] },
      { sku: `${sku}-200`, optionValues: { Size: "200 ml" }, price: prices[1], stock: stock[1] },
    ],
  };
}

function nightwear(
  slug: string,
  name: string,
  sku: string,
  colours: string[],
  price: number,
  compareAtPrice?: number,
): SeedProduct {
  const sizes = ["S", "M", "L"];
  return {
    slug,
    name,
    category: "nightwear",
    collections: ["nightwear"],
    options: [
      { name: "Size", values: sizes },
      { name: "Colour", values: colours },
    ],
    variants: sizes.flatMap((size, i) =>
      colours.map((colour, j) => ({
        sku: `${sku}-${size}-${colour.toUpperCase().slice(0, 3)}`,
        optionValues: { Size: size, Colour: colour },
        price,
        compareAtPrice,
        // Varied placeholder stock, including one sold-out and some low-stock variants.
        stock: (i + j) % 4 === 3 ? 0 : 2 + ((i * 3 + j * 5) % 9),
      })),
    ),
  };
}

const PRODUCTS: SeedProduct[] = [
  butter("whipped-shea-body-butter", "Whipped Shea Body Butter", "BB-SHEA", [1800, 2900], [40, 25]),
  butter(
    "cocoa-vanilla-body-butter",
    "Cocoa and Vanilla Body Butter",
    "BB-COCO",
    [1800, 2900],
    [30, 3],
  ),
  butter(
    "unscented-mango-body-butter",
    "Unscented Mango Body Butter",
    "BB-MANG",
    [1600, 2600],
    [50, 20],
  ),
  {
    ...butter(
      "lavender-night-body-butter",
      "Lavender Night Body Butter",
      "BB-LAVN",
      [2000, 3200],
      [0, 12],
    ),
    collections: ["body-butters", "gift-sets"],
  },
  nightwear("satin-slip-nightdress", "Satin Slip Nightdress", "NW-SLIP", ["Ivory", "Black"], 4500),
  nightwear("cotton-pyjama-set", "Cotton Pyjama Set", "NW-PJSET", ["Blush", "Sage"], 5200, 6000),
  nightwear("lace-trim-cami-set", "Lace Trim Cami Set", "NW-CAMI", ["Champagne"], 3800),
  {
    ...nightwear("satin-robe", "Satin Robe", "NW-ROBE", ["Ivory", "Mocha"], 5800),
    collections: ["nightwear", "gift-sets"],
  },
];

async function seedCatalogue() {
  const categoryIds: Record<string, string> = {};
  for (const c of CATEGORIES) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: { ...c, description: PLACEHOLDER_NOTE },
    });
    categoryIds[c.slug] = row.id;
  }

  const collectionIds: Record<string, string> = {};
  for (const c of COLLECTIONS) {
    const row = await prisma.collection.upsert({
      where: { slug: c.slug },
      update: {},
      create: { ...c, description: PLACEHOLDER_NOTE },
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
        status: "PUBLISHED",
        categoryId: categoryIds[p.category],
        description: doc(`${p.name}. ${PLACEHOLDER_NOTE}`),
        specs: doc("Placeholder specifications. Replace with real ingredients or fabric details."),
        sizeGuide:
          p.category === "nightwear"
            ? doc("Placeholder size guide. Replace with the real size chart.")
            : undefined,
        metaTitle: p.name,
        metaDescription: `${p.name}. Placeholder meta description.`,
        options: {
          create: p.options.map((o, position) => ({ name: o.name, values: o.values, position })),
        },
      },
    });
    productIds[p.slug] = product.id;

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
              ? { create: { delta: v.stock, reason: "RESTOCK", note: "Placeholder seed stock" } }
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
  await prisma.shippingMethod.createMany({
    data: [
      {
        name: "Standard delivery (placeholder)",
        price: 395,
        region: "Domestic",
        estimate: "3 to 5 working days",
      },
      {
        name: "Express delivery (placeholder)",
        price: 795,
        region: "Domestic",
        estimate: "1 to 2 working days",
      },
    ],
  });
}

async function seedHomeSections(
  collectionIds: Record<string, string>,
  productIds: Record<string, string>,
) {
  if ((await prisma.homeSection.count()) > 0) return;

  // Order follows build-plan.md "Homepage sections" (S1). The footer is part of the layout, not a section.
  const sections: {
    type: Prisma.HomeSectionCreateManyInput["type"];
    data: Prisma.InputJsonValue;
  }[] = [
    {
      type: "HERO",
      data: {
        headline: "Placeholder hero headline",
        subheadline: PLACEHOLDER_NOTE,
        buttonLabel: "Shop now",
        buttonHref: "/shop",
        imageIds: [],
        badge: "Placeholder customer count",
      },
    },
    {
      type: "COLLECTION_BANNERS",
      data: {
        items: ["body-butters", "nightwear", "gift-sets"].map((slug) => ({
          collectionId: collectionIds[slug],
          imageId: null,
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
        heading: "Why Rera",
        body: PLACEHOLDER_NOTE,
        points: [
          "Placeholder point one",
          "Placeholder point two",
          "Placeholder point three",
          "Placeholder point four",
        ],
        imageId: null,
      },
    },
    {
      type: "TICKER",
      data: {
        items: [
          "Placeholder ticker message one",
          "Placeholder ticker message two",
          "Placeholder ticker message three",
        ],
      },
    },
    {
      type: "FEATURED_PRODUCT",
      data: {
        productId: productIds["whipped-shea-body-butter"],
        badge: "Most loved",
        body: PLACEHOLDER_NOTE,
      },
    },
    {
      type: "FEATURED_PRODUCT",
      data: {
        productId: productIds["satin-slip-nightdress"],
        badge: "Just in",
        body: PLACEHOLDER_NOTE,
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
        heading: "Shop all",
        body: PLACEHOLDER_NOTE,
        buttonLabel: "Shop all",
        buttonHref: "/shop",
        imageId: null,
      },
    },
    {
      type: "TEXT_IMAGE",
      data: { heading: "Our story", body: PLACEHOLDER_NOTE, imageId: null },
    },
    {
      type: "STEPS",
      data: {
        heading: "How to use",
        steps: [
          { title: "Placeholder step one", body: PLACEHOLDER_NOTE },
          { title: "Placeholder step two", body: PLACEHOLDER_NOTE },
          { title: "Placeholder step three", body: PLACEHOLDER_NOTE },
        ],
      },
    },
    {
      type: "TESTIMONIALS",
      data: { heading: "What customers say", source: "featuredReviews", limit: 6 },
    },
    {
      type: "NEWSLETTER",
      data: { heading: "Join the list", body: PLACEHOLDER_NOTE },
    },
  ];

  await prisma.homeSection.createMany({
    data: sections.map((s, position) => ({
      type: s.type,
      position,
      isVisible: true,
      data: s.data,
    })),
  });
}

async function seedPages() {
  const pages = [
    { slug: "terms", title: "Terms and conditions" },
    { slug: "privacy", title: "Privacy policy" },
    { slug: "shipping-returns", title: "Shipping and returns" },
  ];
  for (const p of pages) {
    await prisma.page.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        slug: p.slug,
        title: p.title,
        body: doc(
          "This page is a placeholder stub. It is not a real policy.",
          "The store owner must replace this text with the real policy before launch.",
        ),
        metaTitle: p.title,
        publishedAt: new Date(),
      },
    });
  }
}

async function seedFaqs() {
  if ((await prisma.faq.count()) > 0) return;
  const answer = "Placeholder answer. Replace with the store's real policy before launch.";
  const faqs = [
    { topic: "Orders", question: "How do I track my order?" },
    { topic: "Orders", question: "Can I change or cancel my order?" },
    { topic: "Shipping", question: "How long does delivery take?" },
    { topic: "Shipping", question: "Where do you deliver?" },
    { topic: "Products", question: "How should I store my body butter?" },
    { topic: "Returns", question: "What is your returns policy?" },
  ];
  await prisma.faq.createMany({ data: faqs.map((f, position) => ({ ...f, answer, position })) });
}

async function seedSettings() {
  const settings: Record<string, Prisma.InputJsonValue> = {
    store: {
      name: "Rera Body",
      contactEmail: "hello@example.com",
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
            { label: "Nightwear", href: "/collections/nightwear" },
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
    seo: { defaultTitle: "Rera Body", defaultDescription: "Placeholder store description." },
    tracking: { carriers: [] },
    chatWidget: { enabled: false, script: "" },
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

  console.log(`Seed complete. Owner account: ${owner.email}. All content is placeholder.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
