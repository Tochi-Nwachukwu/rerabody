import type { Metadata } from "next";
import Link from "next/link";

import { PageTitle } from "@/components/store/page-title";
import { getFaqs } from "@/server/queries/content";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers to common questions about orders, delivery and products.",
  alternates: { canonical: "/faq" },
};

// S29 FAQ
export default async function FaqPage() {
  const faqs = await getFaqs();
  const topics = [...new Set(faqs.map((f) => f.topic))];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
  return (
    <>
      <PageTitle title="Frequently asked questions" />
      <div className="mx-auto flex max-w-3xl flex-col gap-10 px-4 sm:px-6">
        {topics.map((topic) => (
          <section key={topic} aria-labelledby={`t-${topic}`}>
            <h2 id={`t-${topic}`} className="font-heading mb-3 text-2xl">
              {topic}
            </h2>
            <div className="flex flex-col divide-y rounded-xl border">
              {faqs
                .filter((f) => f.topic === topic)
                .map((f) => (
                  <details key={f.id} className="group px-4 py-3">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
                      {f.question}
                      <span
                        aria-hidden
                        className="text-xl transition-transform group-open:rotate-45"
                      >
                        +
                      </span>
                    </summary>
                    <p className="text-muted-foreground mt-2 text-sm whitespace-pre-line">
                      {f.answer}
                    </p>
                  </details>
                ))}
            </div>
          </section>
        ))}
        <p className="text-muted-foreground text-center text-sm">
          Still need help?{" "}
          <Link href="/contact" className="underline underline-offset-4">
            Contact us
          </Link>
          .
        </p>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
    </>
  );
}
