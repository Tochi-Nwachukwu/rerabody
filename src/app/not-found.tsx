import Link from "next/link";

import { Footer } from "@/components/store/footer";
import { Header } from "@/components/store/header";
import { buttonVariants } from "@/components/ui/button";

// S31 not found for URLs that match no route.
export default function NotFound() {
  return (
    <>
      <Header />
      <main id="main" className="flex-1">
        <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-24 text-center">
          <p className="text-muted-foreground text-sm tracking-[0.2em] uppercase">404</p>
          <h1 className="font-heading text-4xl">We could not find that page</h1>
          <p className="text-muted-foreground">
            It may have moved, or the link may be out of date.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/shop" className={buttonVariants()}>
              Shop all
            </Link>
            <Link href="/" className={buttonVariants({ variant: "outline" })}>
              Home
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
