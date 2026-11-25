import type { Metadata } from "next";

/** Site-wide search and share defaults. The homepage text can be changed in Admin > Settings > SEO. */

export const SITE_TITLE = "Rera Body | Rich Body Butters & Elegant Women’s Loungewear";
export const SITE_DESCRIPTION =
  "Nourish and soften your skin with whipped botanical body butters, paired with breathable robes designed for everyday luxury.";

/** Default share image (1200x630), cropped from the body butter carousel photo. */
export const SHARE_IMAGE = {
  url: "/og/rera-body.jpg",
  width: 1200,
  height: 630,
  alt: "Rera body butters in Cranberry Fig + Lavender, True Blue, Vanilla and Lemon Dream",
};

type ShareImage = { url: string; alt?: string | null; width?: number; height?: number };

/**
 * Open Graph and Twitter tags for one page. A page that sets openGraph replaces the site
 * defaults entirely, so this repeats the site name and falls back to the default image.
 */
export function shareMetadata(input: {
  title: string;
  description?: string;
  url: string;
  images?: ShareImage[];
}): Pick<Metadata, "openGraph" | "twitter"> {
  const images = (input.images?.length ? input.images : [SHARE_IMAGE]).map((i) => ({
    ...i,
    alt: i.alt ?? undefined,
  }));
  return {
    openGraph: {
      type: "website",
      siteName: "Rera Body",
      locale: "en_US",
      url: input.url,
      title: input.title,
      description: input.description,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images,
    },
  };
}
