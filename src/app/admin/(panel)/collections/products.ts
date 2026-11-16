import "server-only";

import { db } from "@/server/db";

export function loadProductOptions() {
  return db.product.findMany({
    where: { status: { not: "ARCHIVED" } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, status: true },
  });
}
