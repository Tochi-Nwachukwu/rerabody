"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export type NavLink = { label: string; href: string };

export function MobileMenu({ links, storeName }: { links: NavLink[]; storeName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu" />}
      >
        <Menu />
      </SheetTrigger>
      <SheetContent side="left" className="w-80">
        <SheetHeader>
          <SheetTitle className="font-heading text-xl tracking-[0.12em] uppercase">
            {storeName}
          </SheetTitle>
        </SheetHeader>
        <nav aria-label="Main" className="flex flex-col px-4">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="border-b py-3 text-base"
            >
              {l.label}
            </Link>
          ))}
          <Link href="/account" onClick={() => setOpen(false)} className="border-b py-3 text-base">
            My account
          </Link>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
