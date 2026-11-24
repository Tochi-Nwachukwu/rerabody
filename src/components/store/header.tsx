import { ShoppingBag, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";
import { getCollections } from "@/server/queries/catalog";
import { getMediaByIds } from "@/server/queries/home";
import { getSiteSettings } from "@/server/queries/settings";

import { MobileMenu, type NavLink } from "./mobile-menu";
import { SearchOverlay } from "./search-overlay";

export async function getNavLinks(): Promise<NavLink[]> {
  const collections = await getCollections();
  return [
    { label: "Shop all", href: "/shop" },
    ...collections.slice(0, 4).map((c) => ({ label: c.name, href: `/collections/${c.slug}` })),
    { label: "Offers", href: "/offers" },
  ];
}

// G1 header. The cart slot is filled in by the layout (it reads the cart cookie).
export async function Header({ cartSlot }: { cartSlot?: ReactNode }) {
  const [settings, links] = await Promise.all([getSiteSettings(), getNavLinks()]);
  const [logo] = settings.store.logoMediaId
    ? await getMediaByIds([settings.store.logoMediaId])
    : [];
  return (
    <header className="bg-background/95 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-6">
        <div className="flex items-center gap-1">
          <MobileMenu links={links} storeName={settings.store.name} />
          <nav aria-label="Main" className="hidden items-center gap-5 md:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm hover:underline hover:underline-offset-4"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <Link href="/" className="block">
          <Image
            src={logo?.url ?? "/brand/rera-body-logo.png"}
            alt={settings.store.name}
            width={1545}
            height={549}
            className="h-11 w-auto object-contain sm:h-12"
            priority
          />
        </Link>
        <div className="flex items-center justify-end gap-0.5">
          <SearchOverlay />
          <Link
            href="/account"
            className={buttonVariants({ variant: "ghost", size: "icon" })}
            aria-label="My account"
          >
            <User />
          </Link>
          {cartSlot ?? (
            <Link
              href="/cart"
              className={buttonVariants({ variant: "ghost", size: "icon" })}
              aria-label="Cart"
            >
              <ShoppingBag />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
