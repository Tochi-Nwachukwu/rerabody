import { Quote } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { type SectionData, type SectionType, parseSection } from "@/lib/home-sections";
import {
  getCategories,
  getCollections,
  getPublishedProductCards,
  type ProductCard,
} from "@/server/queries/catalog";
import { getFeaturedReviews, getMediaByIds } from "@/server/queries/home";
import type { RenderSection } from "@/server/services/home-sections";

import { NewsletterForm } from "../newsletter-form";
import { Price } from "../price";
import { ProductGrid } from "../product-card";
import { Stars } from "../stars";
import { HeroRotator } from "./hero-rotator";
import { ProductTabs } from "./product-tabs";

type Media = { id: string; url: string; alt: string | null };
type Ctx = { media: Map<string, Media>; cards: ProductCard[]; currency: string; first: boolean };

function collectMediaIds(sections: RenderSection[]): string[] {
  const ids = new Set<string>();
  const walk = (v: unknown, key?: string) => {
    if (typeof v === "string" && key && /^image(Id|Ids)?$/.test(key)) ids.add(v);
    else if (Array.isArray(v))
      v.forEach((x) => walk(x, key === "imageIds" ? "imageId" : undefined));
    else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => walk(x, k));
  };
  sections.forEach((s) => walk(s.data));
  return [...ids];
}

function CtaButton({
  label,
  href,
  variant = "default",
}: {
  label: string;
  href: string;
  variant?: "default" | "outline";
}) {
  if (!label || !href) return null;
  return (
    <Link href={href} className={buttonVariants({ variant, size: "lg", className: "h-11 px-6" })}>
      {label}
    </Link>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-8 text-center">
      <h2 className="font-heading text-3xl sm:text-4xl">{title}</h2>
      {subtitle ? <p className="text-muted-foreground mt-2">{subtitle}</p> : null}
    </div>
  );
}

function Hero({ d, ctx }: { d: SectionData<"HERO">; ctx: Ctx }) {
  const images = d.imageIds
    .map((id) => ctx.media.get(id))
    .filter((m): m is Media => !!m)
    .map((m) => ({ url: m.url, alt: m.alt ?? "" }));
  const Heading = ctx.first ? "h1" : "h2";
  return (
    <section className="bg-secondary relative flex min-h-[70svh] items-end overflow-hidden">
      {images.length ? <HeroRotator images={images} /> : null}
      {images.length ? (
        <>
          {/* Darkens the image behind the text: a side fade where the text sits, plus a bottom fade. */}
          <div
            className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/35 to-black/5"
            aria-hidden
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent"
            aria-hidden
          />
          {/* On narrow screens the text covers most of the image, so tint all of it. */}
          <div className="absolute inset-0 bg-black/25 sm:hidden" aria-hidden />
        </>
      ) : null}
      <div
        className={`relative mx-auto flex w-full max-w-7xl flex-col items-start gap-4 px-4 pt-24 pb-14 sm:px-6 ${images.length ? "text-white [text-shadow:0_1px_14px_rgb(0_0_0/0.35)]" : ""}`}
      >
        {d.eyebrow ? <p className="text-xs tracking-[0.25em] uppercase">{d.eyebrow}</p> : null}
        <Heading className="font-heading max-w-2xl text-5xl leading-[1.05] sm:text-6xl">
          {d.headline}
        </Heading>
        {d.subheadline ? <p className="max-w-xl text-lg opacity-90">{d.subheadline}</p> : null}
        <div className="flex flex-wrap items-center gap-3">
          <CtaButton label={d.buttonLabel} href={d.buttonHref} />
          {d.badge ? (
            <span className="bg-background/90 text-foreground rounded-full px-3 py-1 text-sm">
              {d.badge}
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}

async function CollectionBanners({ d, ctx }: { d: SectionData<"COLLECTION_BANNERS">; ctx: Ctx }) {
  const collections = new Map((await getCollections()).map((c) => [c.id, c]));
  const items = d.items
    .map((i) => ({ ...i, c: collections.get(i.collectionId) }))
    .filter((i) => i.c);
  if (!items.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      {d.heading ? <SectionHeading title={d.heading} /> : null}
      <ul className={`grid gap-4 ${items.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {items.map((i) => {
          const img = (i.imageId && ctx.media.get(i.imageId)) || i.c!.banner;
          return (
            <li key={i.collectionId}>
              <Link
                href={`/collections/${i.c!.slug}`}
                className="group bg-secondary relative block aspect-[3/4] overflow-hidden rounded-xl sm:aspect-[4/5]"
              >
                {img ? (
                  <Image
                    src={img.url}
                    alt={img.alt ?? ""}
                    fill
                    sizes="(min-width: 640px) 33vw, 100vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : null}
                <span
                  className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"
                  aria-hidden
                />
                <span className="font-heading absolute bottom-0 left-0 p-5 text-3xl text-white">
                  {i.title || i.c!.name}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

async function ProductGridSection({ d, ctx }: { d: SectionData<"PRODUCT_GRID">; ctx: Ctx }) {
  let products: ProductCard[];
  if (d.source === "manual") {
    const byId = new Map(ctx.cards.map((c) => [c.id, c]));
    products = d.productIds.map((id) => byId.get(id)).filter((c): c is ProductCard => !!c);
  } else if (d.source === "bestsellers") {
    products = [...ctx.cards].sort((a, b) => b.salesRank - a.salesRank);
  } else {
    products = [...ctx.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  if (!products.length) return null;
  const categories = d.showCategoryTabs ? await getCategories() : [];
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <SectionHeading title={d.title} subtitle={d.subtitle} />
      {d.showCategoryTabs ? (
        <ProductTabs
          products={products}
          categories={categories}
          currency={ctx.currency}
          limit={d.limit}
        />
      ) : (
        <ProductGrid products={products.slice(0, d.limit)} currency={ctx.currency} />
      )}
      {d.buttonLabel && d.buttonHref ? (
        <div className="mt-10 flex justify-center">
          <CtaButton label={d.buttonLabel} href={d.buttonHref} variant="outline" />
        </div>
      ) : null}
    </section>
  );
}

function FeaturedProduct({ d, ctx }: { d: SectionData<"FEATURED_PRODUCT">; ctx: Ctx }) {
  const p = ctx.cards.find((c) => c.id === d.productId);
  if (!p) return null;
  const img = (d.imageId && ctx.media.get(d.imageId)) || p.image;
  return (
    <section className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-14 sm:px-6 md:grid-cols-2">
      <div className="bg-secondary relative aspect-square overflow-hidden rounded-xl">
        {img ? (
          <Image
            src={img.url}
            alt={img.alt ?? p.name}
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        ) : null}
        {d.badge ? (
          <span className="bg-background absolute top-4 left-4 rounded-full px-3 py-1 text-sm font-medium">
            {d.badge}
          </span>
        ) : null}
      </div>
      <div className="flex flex-col items-start gap-4">
        <h2 className="font-heading text-4xl">{d.heading || p.name}</h2>
        {p.ratingCount > 0 ? (
          <Stars rating={p.ratingAverage} count={p.ratingCount} size="md" />
        ) : null}
        {d.body ? <p className="text-muted-foreground">{d.body}</p> : null}
        <Price
          amount={p.price}
          compareAt={p.compareAtPrice}
          currency={ctx.currency}
          className="text-lg"
        />
        <CtaButton label="Shop now" href={`/products/${p.slug}`} />
      </div>
    </section>
  );
}

function TextImage({ d, ctx }: { d: SectionData<"TEXT_IMAGE">; ctx: Ctx }) {
  const img = d.imageId ? ctx.media.get(d.imageId) : null;
  return (
    <section
      className={`mx-auto grid max-w-7xl items-center gap-8 px-4 py-14 sm:px-6 ${img ? "md:grid-cols-2" : "max-w-3xl text-center"}`}
    >
      {img ? (
        <div
          className={`bg-secondary relative aspect-[4/3] overflow-hidden rounded-xl ${d.imagePosition === "left" ? "" : "md:order-2"}`}
        >
          <Image
            src={img.url}
            alt={img.alt ?? ""}
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
      ) : null}
      <div className={`flex flex-col gap-4 ${img ? "items-start" : "items-center"}`}>
        <h2 className="font-heading text-4xl">{d.heading}</h2>
        {d.body
          .split(/\n\s*\n/)
          .filter(Boolean)
          .map((p, i) => (
            <p key={i} className="text-muted-foreground">
              {p}
            </p>
          ))}
        {d.points.length ? (
          <ul className={`grid gap-3 ${img ? "" : "text-left"} sm:grid-cols-2`}>
            {d.points.map((p) => (
              <li key={p} className="flex gap-2 text-sm">
                <span aria-hidden className="bg-primary mt-2 size-1.5 shrink-0 rounded-full" />
                {p}
              </li>
            ))}
          </ul>
        ) : null}
        <CtaButton label={d.buttonLabel} href={d.buttonHref} />
      </div>
    </section>
  );
}

function Ticker({ d }: { d: SectionData<"TICKER"> }) {
  const items = [...d.items, ...d.items];
  return (
    <section
      aria-label="Announcements"
      className="bg-primary text-primary-foreground overflow-hidden border-y py-3"
    >
      <ul className="sr-only">
        {d.items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <div
        aria-hidden
        className="flex w-max animate-[ticker_30s_linear_infinite] gap-10 whitespace-nowrap hover:[animation-play-state:paused] motion-reduce:animate-none"
      >
        {items.map((t, i) => (
          <span key={i} className="text-sm tracking-wide uppercase">
            {t} <span className="ml-10">✦</span>
          </span>
        ))}
      </div>
    </section>
  );
}

function Steps({ d }: { d: SectionData<"STEPS"> }) {
  return (
    <section className="bg-secondary/40 py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading title={d.heading} />
        <ol className="grid gap-6 sm:grid-cols-3">
          {d.steps.map((s, i) => (
            <li key={i} className="flex flex-col items-center gap-2 text-center">
              <span
                className="border-primary font-heading flex size-12 items-center justify-center rounded-full border-2 text-xl"
                aria-hidden
              >
                {i + 1}
              </span>
              <h3 className="font-medium">{s.title}</h3>
              {s.body ? <p className="text-muted-foreground text-sm">{s.body}</p> : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

async function Testimonials({ d }: { d: SectionData<"TESTIMONIALS"> }) {
  const reviews = await getFeaturedReviews(d.limit);
  if (!reviews.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <SectionHeading title={d.heading} />
      <ul
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2"
        aria-label="Customer reviews"
      >
        {reviews.map((r) => (
          <li
            key={r.id}
            className="bg-card flex w-[85%] shrink-0 snap-start flex-col gap-3 rounded-xl border p-5 sm:w-[45%] lg:w-[30%]"
          >
            <Quote className="text-muted-foreground size-5" aria-hidden />
            <Stars rating={r.rating} />
            {r.title ? <p className="font-medium">{r.title}</p> : null}
            <p className="text-muted-foreground text-sm">{r.body}</p>
            <p className="mt-auto text-sm">
              {r.user.name.split(" ")[0]} on{" "}
              <Link href={`/products/${r.product.slug}`} className="underline underline-offset-4">
                {r.product.name}
              </Link>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Newsletter({ d }: { d: SectionData<"NEWSLETTER"> }) {
  return (
    <section className="bg-secondary/60 py-14">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 text-center">
        <h2 className="font-heading text-4xl">{d.heading}</h2>
        {d.body ? <p className="text-muted-foreground">{d.body}</p> : null}
        <NewsletterForm />
      </div>
    </section>
  );
}

function renderOne(type: SectionType, data: unknown, ctx: Ctx) {
  const parsed = parseSection(type, data);
  if (!parsed.success) return null; // Invalid data never renders.
  const d = parsed.data as never;
  switch (type) {
    case "HERO":
      return <Hero d={d} ctx={ctx} />;
    case "COLLECTION_BANNERS":
      return <CollectionBanners d={d} ctx={ctx} />;
    case "PRODUCT_GRID":
      return <ProductGridSection d={d} ctx={ctx} />;
    case "FEATURED_PRODUCT":
      return <FeaturedProduct d={d} ctx={ctx} />;
    case "TEXT_IMAGE":
      return <TextImage d={d} ctx={ctx} />;
    case "TICKER":
      return <Ticker d={d} />;
    case "STEPS":
      return <Steps d={d} />;
    case "TESTIMONIALS":
      return <Testimonials d={d} />;
    case "NEWSLETTER":
      return <Newsletter d={d} />;
  }
}

/** S1: composes the homepage from sections in order. */
export async function HomeSections({
  sections,
  currency,
}: {
  sections: RenderSection[];
  currency: string;
}) {
  const [media, cards] = await Promise.all([
    getMediaByIds(collectMediaIds(sections)),
    getPublishedProductCards(),
  ]);
  const mediaMap = new Map(media.map((m) => [m.id, m]));
  const hasH1 = sections[0]?.type === "HERO";
  return (
    <>
      {!hasH1 ? <h1 className="sr-only">Rera Body</h1> : null}
      {sections.map((s, i) => (
        <div key={s.id} data-section={s.type.toLowerCase()}>
          {renderOne(s.type, s.data, { media: mediaMap, cards, currency, first: i === 0 })}
        </div>
      ))}
    </>
  );
}
