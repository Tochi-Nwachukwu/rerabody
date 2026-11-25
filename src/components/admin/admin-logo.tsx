import Image from "next/image";

import { cn } from "@/lib/utils";

/** The Rera Body logo for the admin sidebar, top bar and mobile menu. */
export function AdminLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/rera-body-logo.png"
      alt="Rera Body admin"
      width={1545}
      height={549}
      className={cn("h-10 w-auto object-contain", className)}
      priority
    />
  );
}
