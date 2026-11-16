import { NextResponse } from "next/server";

import { env } from "@/env";
import { formatMoney } from "@/lib/money";
import { db } from "@/server/db";
import { getPublishedProductCards } from "@/server/queries/catalog";
import { searchProductIds } from "@/server/services/search";

/** G2 autocomplete. Returns at most six published products. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ items: [] });
  const [ids, cards] = await Promise.all([searchProductIds(db, q, 6), getPublishedProductCards()]);
  const byId = new Map(cards.map((c) => [c.id, c]));
  const items = ids
    .map((id) => byId.get(id))
    .filter((c) => c !== undefined)
    .map((c) => ({
      name: c.name,
      slug: c.slug,
      price: formatMoney(c.price, env.STORE_CURRENCY),
      image: c.image,
    }));
  return NextResponse.json(
    { items },
    { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
  );
}
