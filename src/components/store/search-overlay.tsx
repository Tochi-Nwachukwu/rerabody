"use client";

import { Search, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type Suggestion = {
  name: string;
  slug: string;
  price: string;
  image: { url: string; alt: string | null } | null;
};

// G2 search overlay with autocomplete
export function SearchOverlay() {
  const router = useRouter();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const t = setTimeout(async () => {
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      setLoading(true);
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(term)}`, {
          signal: ctrl.signal,
        });
        const body = (await res.json()) as { items: Suggestion[] };
        setItems(body.items);
        setActive(-1);
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  const shown = q.trim().length >= 2 ? items : [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon" aria-label="Search" />}>
        <Search />
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="top-0 max-w-none translate-y-0 rounded-none p-0 sm:top-16 sm:max-w-xl sm:rounded-xl"
      >
        <DialogTitle className="sr-only">Search the store</DialogTitle>
        <form
          role="search"
          className="flex items-center gap-2 border-b px-3 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (active >= 0 && shown[active]) return go(`/products/${shown[active].slug}`);
            if (q.trim()) go(`/search?q=${encodeURIComponent(q.trim())}`);
          }}
        >
          <Search className="text-muted-foreground size-4" aria-hidden />
          <input
            autoFocus
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(shown.length - 1, a + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(-1, a - 1));
              }
            }}
            placeholder="Search body butters and loungewear"
            aria-label="Search products"
            role="combobox"
            aria-expanded={shown.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            className="h-11 flex-1 bg-transparent text-base outline-none"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close search"
            onClick={() => setOpen(false)}
          >
            <X />
          </Button>
        </form>
        <div className="max-h-[60svh] overflow-y-auto p-2" aria-live="polite">
          {shown.length > 0 ? (
            <ul id={listId} role="listbox" aria-label="Suggestions">
              {shown.map((s, i) => (
                <li key={s.slug} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                  <Link
                    href={`/products/${s.slug}`}
                    onClick={() => setOpen(false)}
                    className={`hover:bg-muted flex items-center gap-3 rounded-md p-2 ${i === active ? "bg-muted" : ""}`}
                  >
                    <span className="bg-muted relative size-12 shrink-0 overflow-hidden rounded">
                      {s.image ? (
                        <Image
                          src={s.image.url}
                          alt=""
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      ) : null}
                    </span>
                    <span className="flex-1 text-sm">{s.name}</span>
                    <span className="text-muted-foreground text-sm">{s.price}</span>
                  </Link>
                </li>
              ))}
              <li role="option" aria-selected={false}>
                <Link
                  href={`/search?q=${encodeURIComponent(q.trim())}`}
                  onClick={() => setOpen(false)}
                  className="block rounded-md p-2 text-sm underline underline-offset-4"
                >
                  See all results for “{q.trim()}”
                </Link>
              </li>
            </ul>
          ) : q.trim().length >= 2 && !loading ? (
            <p className="text-muted-foreground p-3 text-sm">
              No products found. Press Enter to search everything.
            </p>
          ) : (
            <p className="text-muted-foreground p-3 text-sm">Start typing to search.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
