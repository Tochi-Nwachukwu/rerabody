import Link from "next/link";
import type { ReactNode } from "react";

import { getSiteSettings } from "@/server/queries/settings";

// G4 footer: Shop, Help and About columns and contact details from SiteSetting.
export async function Footer({ newsletterSlot }: { newsletterSlot?: ReactNode }) {
  const { store, footer, social } = await getSiteSettings();
  const socials = [
    { label: "Instagram", href: social.instagram },
    { label: "TikTok", href: social.tiktok },
    { label: "Facebook", href: social.facebook },
  ].filter((s) => s.href);
  return (
    <footer className="bg-secondary/40 mt-16 border-t">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="flex flex-col gap-3">
          <p className="font-heading text-2xl font-semibold tracking-[0.14em] uppercase">
            {store.name}
          </p>
          {newsletterSlot}
          {store.contactEmail ? (
            <p className="text-sm">
              <a href={`mailto:${store.contactEmail}`} className="underline underline-offset-4">
                {store.contactEmail}
              </a>
            </p>
          ) : null}
          {store.contactPhone ? <p className="text-sm">{store.contactPhone}</p> : null}
          {store.address ? <p className="text-muted-foreground text-sm">{store.address}</p> : null}
          {socials.length ? (
            <ul className="flex gap-4 text-sm">
              {socials.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-4"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {footer.columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="mb-3 text-sm font-semibold tracking-wide uppercase">{col.title}</h2>
            <ul className="flex flex-col gap-2 text-sm">
              {col.links.map((l) => (
                <li key={l.href + l.label}>
                  <Link
                    href={l.href}
                    className="text-muted-foreground hover:text-foreground hover:underline hover:underline-offset-4"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t">
        <p className="text-muted-foreground mx-auto max-w-7xl px-4 py-4 text-xs sm:px-6">
          {footer.note || `© ${store.name}`}
        </p>
      </div>
    </footer>
  );
}

export function StoreChrome({
  header,
  footer,
  children,
}: {
  header: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      {header}
      <main id="main" className="flex-1">
        {children}
      </main>
      {footer}
    </>
  );
}
