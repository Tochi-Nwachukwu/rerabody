import { z } from "zod";

/**
 * Homepage section types (S1). Each has a Zod schema for its JSON data and a
 * field list the A20 editor uses to build its form. The same schema validates
 * in the browser and on the server.
 */

const text = (max: number) => z.string().trim().max(max);
const required = (max: number, msg = "Required") => z.string().trim().min(1, msg).max(max);
const href = z
  .string()
  .trim()
  .max(300)
  .refine(
    (v) => v === "" || v.startsWith("/") || v.startsWith("https://"),
    "Use a path like /shop or a full https:// link",
  );
const id = z.string().min(1);

export const sectionSchemas = {
  HERO: z.object({
    eyebrow: text(60).default(""),
    headline: required(120, "Enter a headline"),
    subheadline: text(300).default(""),
    buttonLabel: text(40).default(""),
    buttonHref: href.default(""),
    imageIds: z.array(id).max(5).default([]),
    badge: text(60).default(""),
  }),
  COLLECTION_BANNERS: z.object({
    heading: text(80).default(""),
    items: z
      .array(
        z.object({
          collectionId: required(64, "Choose a collection"),
          title: text(60).default(""),
          imageId: id.nullable().default(null),
        }),
      )
      .min(1, "Add at least one collection")
      .max(4),
  }),
  PRODUCT_GRID: z.object({
    title: required(80, "Enter a title"),
    subtitle: text(200).default(""),
    source: z.enum(["manual", "bestsellers", "newest"]).default("manual"),
    productIds: z.array(id).max(12).default([]),
    limit: z.number().int().min(1).max(12).default(6),
    showCategoryTabs: z.boolean().default(false),
    buttonLabel: text(40).default(""),
    buttonHref: href.default(""),
  }),
  FEATURED_PRODUCT: z.object({
    productId: required(64, "Choose a product"),
    badge: text(30).default(""),
    heading: text(120).default(""),
    body: text(600).default(""),
    imageId: id.nullable().default(null),
  }),
  TEXT_IMAGE: z.object({
    heading: required(120, "Enter a heading"),
    body: text(2000).default(""),
    points: z.array(required(160)).max(6).default([]),
    imageId: id.nullable().default(null),
    imagePosition: z.enum(["left", "right"]).default("right"),
    buttonLabel: text(40).default(""),
    buttonHref: href.default(""),
  }),
  TICKER: z.object({ items: z.array(required(120)).min(1, "Add at least one message").max(10) }),
  STEPS: z.object({
    heading: required(120, "Enter a heading"),
    steps: z
      .array(z.object({ title: required(80), body: text(400).default("") }))
      .min(1, "Add at least one step")
      .max(6),
  }),
  TESTIMONIALS: z.object({
    heading: required(120, "Enter a heading"),
    limit: z.number().int().min(1).max(12).default(6),
  }),
  NEWSLETTER: z.object({ heading: required(120, "Enter a heading"), body: text(300).default("") }),
} as const;

export type SectionType = keyof typeof sectionSchemas;
export type SectionData<T extends SectionType = SectionType> = z.output<(typeof sectionSchemas)[T]>;
export const SECTION_TYPES = Object.keys(sectionSchemas) as SectionType[];

export const SECTION_LABELS: Record<SectionType, string> = {
  HERO: "Hero",
  COLLECTION_BANNERS: "Collection banners",
  PRODUCT_GRID: "Product grid",
  FEATURED_PRODUCT: "Featured product",
  TEXT_IMAGE: "Text and image",
  TICKER: "Ticker",
  STEPS: "Steps",
  TESTIMONIALS: "Testimonials",
  NEWSLETTER: "Newsletter signup",
};

export function parseSection(type: SectionType, data: unknown) {
  return sectionSchemas[type].safeParse(data);
}

/** Starting data for a new section of each type. Some need editing before they validate (a product, a collection). */
export const SECTION_DEFAULTS: Record<SectionType, Record<string, unknown>> = {
  HERO: {
    headline: "New headline",
    subheadline: "",
    buttonLabel: "Shop now",
    buttonHref: "/shop",
    imageIds: [],
  },
  COLLECTION_BANNERS: { heading: "", items: [{ collectionId: "", title: "", imageId: null }] },
  PRODUCT_GRID: {
    title: "Products",
    source: "newest",
    productIds: [],
    limit: 6,
    showCategoryTabs: false,
  },
  FEATURED_PRODUCT: { productId: "", badge: "", heading: "", body: "", imageId: null },
  TEXT_IMAGE: {
    heading: "New section",
    body: "",
    points: [],
    imageId: null,
    imagePosition: "right",
  },
  TICKER: { items: ["New message"] },
  STEPS: { heading: "How it works", steps: [{ title: "Step one", body: "" }] },
  TESTIMONIALS: { heading: "What customers say", limit: 6 },
  NEWSLETTER: { heading: "Join the list", body: "" },
};

/** Field descriptors that drive the A20 form. */
export type Field =
  | { key: string; label: string; kind: "text" | "textarea" | "href"; help?: string }
  | { key: string; label: string; kind: "number"; min: number; max: number }
  | { key: string; label: string; kind: "boolean" }
  | { key: string; label: string; kind: "select"; options: { value: string; label: string }[] }
  | { key: string; label: string; kind: "image" | "images" | "product" | "products" | "collection" }
  | { key: string; label: string; kind: "list"; itemLabel: string }
  | {
      key: string;
      label: string;
      kind: "repeater";
      itemLabel: string;
      fields: Field[];
      blank: Record<string, unknown>;
    };

export const SECTION_FIELDS: Record<SectionType, Field[]> = {
  HERO: [
    { key: "eyebrow", label: "Small text above the headline", kind: "text" },
    { key: "headline", label: "Headline", kind: "text" },
    { key: "subheadline", label: "Subheadline", kind: "textarea" },
    { key: "buttonLabel", label: "Button label", kind: "text" },
    { key: "buttonHref", label: "Button link", kind: "href" },
    { key: "imageIds", label: "Images (rotate every few seconds)", kind: "images" },
    { key: "badge", label: "Badge, for example a customer count", kind: "text" },
  ],
  COLLECTION_BANNERS: [
    { key: "heading", label: "Heading (optional)", kind: "text" },
    {
      key: "items",
      label: "Banners",
      kind: "repeater",
      itemLabel: "Banner",
      blank: { collectionId: "", title: "", imageId: null },
      fields: [
        { key: "collectionId", label: "Collection", kind: "collection" },
        { key: "title", label: "Title (defaults to the collection name)", kind: "text" },
        { key: "imageId", label: "Image (defaults to the collection banner)", kind: "image" },
      ],
    },
  ],
  PRODUCT_GRID: [
    { key: "title", label: "Title", kind: "text" },
    { key: "subtitle", label: "Subtitle", kind: "text" },
    {
      key: "source",
      label: "Products to show",
      kind: "select",
      options: [
        { value: "manual", label: "Chosen by hand" },
        { value: "bestsellers", label: "Best sellers" },
        { value: "newest", label: "Newest" },
      ],
    },
    { key: "productIds", label: "Products (when chosen by hand)", kind: "products" },
    { key: "limit", label: "How many", kind: "number", min: 1, max: 12 },
    { key: "showCategoryTabs", label: "Show category tabs", kind: "boolean" },
    { key: "buttonLabel", label: "Button label", kind: "text" },
    { key: "buttonHref", label: "Button link", kind: "href" },
  ],
  FEATURED_PRODUCT: [
    { key: "productId", label: "Product", kind: "product" },
    { key: "badge", label: "Badge, for example Most loved", kind: "text" },
    { key: "heading", label: "Heading (defaults to the product name)", kind: "text" },
    { key: "body", label: "Text", kind: "textarea" },
    { key: "imageId", label: "Image (defaults to the product cover)", kind: "image" },
  ],
  TEXT_IMAGE: [
    { key: "heading", label: "Heading", kind: "text" },
    {
      key: "body",
      label: "Text",
      kind: "textarea",
      help: "Leave a blank line between paragraphs.",
    },
    { key: "points", label: "Points", kind: "list", itemLabel: "Point" },
    { key: "imageId", label: "Image", kind: "image" },
    {
      key: "imagePosition",
      label: "Image side",
      kind: "select",
      options: [
        { value: "right", label: "Right" },
        { value: "left", label: "Left" },
      ],
    },
    { key: "buttonLabel", label: "Button label", kind: "text" },
    { key: "buttonHref", label: "Button link", kind: "href" },
  ],
  TICKER: [{ key: "items", label: "Messages", kind: "list", itemLabel: "Message" }],
  STEPS: [
    { key: "heading", label: "Heading", kind: "text" },
    {
      key: "steps",
      label: "Steps",
      kind: "repeater",
      itemLabel: "Step",
      blank: { title: "", body: "" },
      fields: [
        { key: "title", label: "Title", kind: "text" },
        { key: "body", label: "Text", kind: "textarea" },
      ],
    },
  ],
  TESTIMONIALS: [
    { key: "heading", label: "Heading", kind: "text" },
    { key: "limit", label: "How many featured reviews", kind: "number", min: 1, max: 12 },
  ],
  NEWSLETTER: [
    { key: "heading", label: "Heading", kind: "text" },
    { key: "body", label: "Text", kind: "textarea" },
  ],
};

/** Short description for the A19 list. */
export function sectionSummary(type: SectionType, data: unknown): string {
  const d = (data ?? {}) as Record<string, unknown>;
  switch (type) {
    case "HERO":
      return String(d.headline ?? "");
    case "TICKER":
      return Array.isArray(d.items) ? d.items.join(" · ") : "";
    case "COLLECTION_BANNERS":
      return `${Array.isArray(d.items) ? d.items.length : 0} banner(s)`;
    case "PRODUCT_GRID":
      return `${d.title ?? ""} (${d.source ?? "manual"})`;
    default:
      return String(d.heading ?? d.title ?? "");
  }
}
