import Link from "next/link";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10 sm:py-16">
      <Link
        href="/"
        className="font-heading mb-8 text-2xl font-semibold tracking-[0.12em] uppercase"
      >
        Rera Body
      </Link>
      <main id="main" className="w-full max-w-sm">
        {children}
      </main>
    </div>
  );
}
