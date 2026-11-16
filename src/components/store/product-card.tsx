import Image from "next/image";
import Link from "next/link";

import type { ProductCard as Card } from "@/server/queries/catalog";

import { Price } from "./price";
import { Stars } from "./stars";

export function ProductCard({
  product,
  currency,
  priority = false,
  headingLevel = "h3",
}: {
  product: Card;
  currency: string;
  priority?: boolean;
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  return (
    <article className="group relative flex flex-col gap-2">
      <div className="bg-muted relative aspect-[4/5] overflow-hidden rounded-lg">
        {product.image ? (
          <>
            <Image
              src={product.image.url}
              alt={product.image.alt ?? product.name}
              fill
              priority={priority}
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              className={
                product.hoverImage
                  ? "object-cover transition-opacity duration-300 group-hover:opacity-0"
                  : "object-cover"
              }
            />
            {product.hoverImage ? (
              <Image
                src={product.hoverImage.url}
                alt=""
                fill
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                className="object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              />
            ) : null}
          </>
        ) : (
          <div className="font-heading text-muted-foreground flex h-full items-center justify-center px-4 text-center text-lg">
            {product.name}
          </div>
        )}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {!product.inStock ? (
            <span className="bg-background/90 rounded px-2 py-0.5 text-xs font-medium">
              Sold out
            </span>
          ) : product.onSale ? (
            <span className="rounded bg-red-800 px-2 py-0.5 text-xs font-medium text-white">
              Sale
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col gap-0.5">
        <Heading className="text-sm leading-snug font-medium">
          <Link
            href={`/products/${product.slug}`}
            className="focus-visible:after:ring-ring after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:ring-2"
          >
            {product.name}
          </Link>
        </Heading>
        {product.ratingCount > 0 ? (
          <Stars rating={product.ratingAverage} count={product.ratingCount} />
        ) : null}
        <Price
          amount={product.price}
          compareAt={product.compareAtPrice}
          currency={currency}
          className="text-sm"
        />
      </div>
    </article>
  );
}

export function ProductGrid({
  products,
  currency,
  priorityCount = 0,
  headingLevel = "h3",
}: {
  products: Card[];
  currency: string;
  priorityCount?: number;
  headingLevel?: "h2" | "h3";
}) {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-5">
      {products.map((p, i) => (
        <li key={p.id}>
          <ProductCard
            product={p}
            currency={currency}
            priority={i < priorityCount}
            headingLevel={headingLevel}
          />
        </li>
      ))}
    </ul>
  );
}
