import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { RichText, hasRichText, richTextToPlain } from "@/components/rich-text";
import { ProductGrid } from "@/components/store/product-card";
import { ProductView } from "@/components/store/product-view";
import { ReviewsBlock } from "@/components/store/reviews/reviews-block";
import { Stars } from "@/components/store/stars";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { env } from "@/env";
import { minorUnitDigits } from "@/lib/money";
import { absoluteUrl } from "@/lib/site";
import { getStaff } from "@/server/auth/session";
import { shareMetadata } from "@/lib/seo";
import {
  type ProductDetail,
  getProductBySlug,
  getProductForPreview,
  getPublishedProductCards,
} from "@/server/queries/catalog";

export async function generateMetadata({
  params,
}: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return { title: "Product not found", robots: { index: false } };
  const description = p.metaDescription || richTextToPlain(p.description, 160) || undefined;
  return {
    title: p.metaTitle || p.name,
    description,
    alternates: { canonical: `/products/${p.slug}` },
    ...shareMetadata({
      title: p.metaTitle || p.name,
      description,
      url: `/products/${p.slug}`,
      images: p.images.slice(0, 4).map((i) => ({ url: i.url, alt: i.alt })),
    }),
  };
}

// S5 product
export default function ProductPage({ params, searchParams }: PageProps<"/products/[slug]">) {
  return (
    <Suspense fallback={<ProductSkeleton />}>
      <Product params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Product({ params, searchParams }: PageProps<"/products/[slug]">) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  let product: ProductDetail | null = await getProductBySlug(slug);
  let preview = false;
  if (!product && sp.preview === "1") {
    const staff = await getStaff();
    if (staff?.permissions.has("products.read")) {
      product = await getProductForPreview(slug);
      preview = !!product;
    }
  }
  if (!product) notFound();

  const currency = env.STORE_CURRENCY;
  const tabs = [
    { id: "description", label: "Description", body: product.description },
    { id: "details", label: "Details", body: product.specs },
    { id: "size-guide", label: "Size guide", body: product.sizeGuide },
  ].filter((t) => hasRichText(t.body));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      {preview ? (
        <p
          role="status"
          className="mb-4 rounded-lg border border-amber-700/30 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          Preview. This product is {product.status.toLowerCase()} and hidden from customers.
        </p>
      ) : null}
      <nav aria-label="Breadcrumb" className="text-muted-foreground mb-4 text-sm">
        <ol className="flex flex-wrap gap-1.5">
          <li>
            <Link href="/shop" className="hover:underline">
              Shop
            </Link>
          </li>
          {product.category ? (
            <li>
              <span aria-hidden>/ </span>
              <Link href={`/shop?category=${product.category.slug}`} className="hover:underline">
                {product.category.name}
              </Link>
            </li>
          ) : null}
          <li aria-current="page">
            <span aria-hidden>/ </span>
            {product.name}
          </li>
        </ol>
      </nav>
      <ProductView
        name={product.name}
        images={product.images.map((i) => ({ id: i.id, url: i.url, alt: i.alt }))}
        options={product.options}
        variants={product.variants}
        currency={currency}
        initialVariantId={typeof sp.variant === "string" ? sp.variant : undefined}
        header={
          <div className="flex flex-col gap-2">
            <h1 className="font-heading text-4xl leading-tight font-medium">{product.name}</h1>
            {product.ratingCount > 0 ? (
              <a href="#reviews" className="w-fit">
                <Stars rating={product.ratingAverage} count={product.ratingCount} size="md" />
              </a>
            ) : null}
          </div>
        }
      />
      {tabs.length ? (
        <Tabs defaultValue={tabs[0].id} className="mt-12">
          <TabsList className="w-full justify-start overflow-x-auto">
            {tabs.map((t) => (
              <TabsTrigger key={t.id} value={t.id}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((t) => (
            <TabsContent key={t.id} value={t.id} className="max-w-3xl pt-4">
              <RichText value={t.body} />
            </TabsContent>
          ))}
        </Tabs>
      ) : null}
      {!preview ? (
        <Suspense fallback={<Skeleton className="mt-16 h-40 w-full" />}>
          <ReviewsBlock
            productId={product.id}
            average={product.ratingAverage}
            count={product.ratingCount}
          />
        </Suspense>
      ) : null}
      {!preview ? <ProductJsonLd product={product} currency={currency} /> : null}
      <Related product={product} currency={currency} />
    </div>
  );
}

async function Related({ product, currency }: { product: ProductDetail; currency: string }) {
  const cards = await getPublishedProductCards();
  const related = cards
    .filter(
      (c) => c.id !== product.id && product.category && c.categorySlug === product.category.slug,
    )
    .slice(0, 4);
  if (!related.length) return null;
  return (
    <section aria-labelledby="related" className="mt-16">
      <h2 id="related" className="font-heading mb-6 text-3xl">
        You may also like
      </h2>
      <ProductGrid products={related} currency={currency} />
    </section>
  );
}

function ProductJsonLd({ product, currency }: { product: ProductDetail; currency: string }) {
  const digits = minorUnitDigits(currency);
  const price = (n: number) => (n / 10 ** digits).toFixed(digits);
  const prices = product.variants.map((v) => v.price);
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: richTextToPlain(product.description, 500) || undefined,
    image: product.images.map((i) => i.url),
    sku: product.variants[0]?.sku,
    brand: { "@type": "Brand", name: "Rera Body" },
    url: absoluteUrl(`/products/${product.slug}`),
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: currency,
      lowPrice: price(Math.min(...prices)),
      highPrice: price(Math.max(...prices)),
      offerCount: product.variants.length,
      availability: product.variants.some((v) => v.stock > 0)
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
    ...(product.ratingCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.ratingAverage.toFixed(1),
            reviewCount: product.ratingCount,
          },
        }
      : {}),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

function ProductSkeleton() {
  return (
    <div
      className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-2"
      aria-label="Loading product"
    >
      <Skeleton className="aspect-[4/5] w-full" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-6 w-1/4" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}
