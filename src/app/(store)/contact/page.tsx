import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ContactForm } from "@/components/store/contact-form";
import { PageTitle } from "@/components/store/page-title";
import { getSession } from "@/server/auth/session";
import { getSiteSettings } from "@/server/queries/settings";

export const metadata: Metadata = {
  title: "Contact us",
  description: "Send us a message. We reply by email.",
  alternates: { canonical: "/contact" },
};

// S28 contact
export default async function ContactPage() {
  const { store } = await getSiteSettings();
  return (
    <>
      <PageTitle title="Contact us">
        <p>
          Have a question? Check the{" "}
          <Link href="/faq" className="underline underline-offset-4">
            FAQ
          </Link>{" "}
          first, or send us a message.
        </p>
      </PageTitle>
      <div className="mx-auto grid max-w-4xl gap-10 px-4 sm:px-6 md:grid-cols-[1fr_16rem]">
        <Suspense fallback={<ContactForm defaults={{ name: "", email: "" }} />}>
          <Prefilled />
        </Suspense>
        <aside className="flex flex-col gap-2 text-sm">
          {store.contactEmail ? (
            <p>
              Email:{" "}
              <a href={`mailto:${store.contactEmail}`} className="underline underline-offset-4">
                {store.contactEmail}
              </a>
            </p>
          ) : null}
          {store.contactPhone ? <p>Phone: {store.contactPhone}</p> : null}
          {store.address ? (
            <p className="text-muted-foreground whitespace-pre-line">{store.address}</p>
          ) : null}
        </aside>
      </div>
    </>
  );
}

async function Prefilled() {
  const session = await getSession();
  return (
    <ContactForm defaults={{ name: session?.user.name ?? "", email: session?.user.email ?? "" }} />
  );
}
