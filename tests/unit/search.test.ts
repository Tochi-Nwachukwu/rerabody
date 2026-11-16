import { beforeEach, describe, expect, it } from "vitest";

import { searchProductIds } from "@/server/services/search";

import { resetDb, testDb } from "../helpers/db";
import { createProduct } from "../helpers/factories";

describe("product search", () => {
  beforeEach(resetDb);

  it("finds published products by full text and by misspelt names, never drafts", async () => {
    const lavender = await createProduct({ name: "Lavender Night Body Butter" });
    const slip = await createProduct({ name: "Satin Slip Nightdress" });
    const draft = await createProduct({ name: "Lavender Draft Butter", status: "DRAFT" });

    expect(await searchProductIds(testDb, "butter")).toEqual([lavender.id]);
    expect(await searchProductIds(testDb, "lavendr buter")).toContain(lavender.id);
    expect(await searchProductIds(testDb, "satn slip")).toEqual([slip.id]);
    expect(await searchProductIds(testDb, "lavender")).not.toContain(draft.id);
    expect(await searchProductIds(testDb, "x")).toEqual([]);
  });

  it("matches words in the description", async () => {
    const p = await createProduct({ name: "Night Balm" });
    await testDb.product.update({
      where: { id: p.id },
      data: {
        description: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Rich in shea and cocoa" }] },
          ],
        },
      },
    });
    expect(await searchProductIds(testDb, "cocoa")).toEqual([p.id]);
  });
});
