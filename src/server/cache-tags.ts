import { revalidateTag } from "next/cache";

/** Storefront cache tags (BUILD_PLAN section 4). */
export const TAGS = {
  products: "products",
  product: (id: string) => `product:${id}`,
  categories: "categories",
  collections: "collections",
  collection: (id: string) => `collection:${id}`,
  home: "home",
  page: (slug: string) => `page:${slug}`,
  faq: "faq",
  settings: "settings",
  shipping: "shipping",
  reviews: (productId: string) => `reviews:${productId}`,
  offers: "offers",
  media: "media",
  featuredReviews: "featured-reviews",
} as const;

/** Expires tags immediately. Works in Server Actions and route handlers alike. */
export function expireTags(...tags: string[]) {
  for (const tag of new Set(tags)) revalidateTag(tag, { expire: 0 });
}
