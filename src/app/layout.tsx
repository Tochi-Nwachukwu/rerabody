import type { Metadata } from "next";
import { Cormorant_Garamond, Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

import { SHARE_IMAGE, SITE_DESCRIPTION, SITE_TITLE } from "@/lib/seo";

const sans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Placeholder serif display font until brand assets arrive.
const serif = Cormorant_Garamond({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  applicationName: "Rera Body",
  title: {
    default: SITE_TITLE,
    template: "%s | Rera Body",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "body butter",
    "whipped body butter",
    "botanical body butter",
    "women's loungewear",
    "robes",
    "self-care gifts",
    "Rera Body",
  ],
  // Fallback for pages without their own share tags: site name and image only, so a
  // shared page never shows the homepage title. Pages with their own use shareMetadata().
  openGraph: {
    type: "website",
    siteName: "Rera Body",
    locale: "en_US",
    images: [SHARE_IMAGE],
  },
  twitter: { card: "summary_large_image", images: [SHARE_IMAGE] },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} ${serif.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="focus:bg-background sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
