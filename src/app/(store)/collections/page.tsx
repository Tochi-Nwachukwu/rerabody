import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { PageTitle } from "@/components/store/page-title";
import { getCollections } from "@/server/queries/catalog";

export const metadata: Metadata = {
  title: "Collections",
  alternates: { canonical: "/collections" },
};

// S3 collections
export default async function CollectionsPage() {
  const collections = await getCollections();
  return (
    <>
      <PageTitle title="Collections" />
      <ul className="mx-auto grid max-w-7xl gap-4 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
        {collections.map((c, i) => (
          <li key={c.id}>
            <Link
              href={`/collections/${c.slug}`}
              className="group bg-secondary relative block aspect-[4/3] overflow-hidden rounded-xl"
            >
              {c.banner ? (
                <Image
                  src={c.banner.url}
                  alt={c.banner.alt ?? c.name}
                  fill
                  priority={i < 2}
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : null}
              <span className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
              <span className="absolute bottom-0 left-0 p-5 text-white">
                <span className="font-heading block text-3xl">{c.name}</span>
                <span className="text-sm">
                  {c.productCount} product{c.productCount === 1 ? "" : "s"}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
