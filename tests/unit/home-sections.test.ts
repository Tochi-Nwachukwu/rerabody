import { beforeEach, describe, expect, it } from "vitest";

import { SECTION_DEFAULTS, SECTION_TYPES, parseSection, sectionSchemas } from "@/lib/home-sections";
import {
  addSection,
  discardHomepageDraft,
  hasUnpublishedChanges,
  listDraftSections,
  loadPublishedSections,
  publishHomepage,
  removeSection,
  reorderSections,
  saveSectionDraft,
  setSectionVisibility,
} from "@/server/services/home-sections";

import { resetDb, testDb } from "../helpers/db";
import { createRole, createUser } from "../helpers/factories";

describe("section schemas", () => {
  it("accept the defaults for sections that need no references", () => {
    for (const type of SECTION_TYPES) {
      if (type === "FEATURED_PRODUCT" || type === "COLLECTION_BANNERS") continue;
      expect(parseSection(type, SECTION_DEFAULTS[type]).success).toBe(true);
    }
  });
  it("reject invalid data", () => {
    expect(parseSection("HERO", { headline: "" }).success).toBe(false);
    expect(
      parseSection("HERO", { headline: "Hi", buttonHref: "javascript:alert(1)" }).success,
    ).toBe(false);
    expect(parseSection("TICKER", { items: [] }).success).toBe(false);
    expect(parseSection("PRODUCT_GRID", { title: "x", limit: 99 }).success).toBe(false);
    expect(parseSection("FEATURED_PRODUCT", SECTION_DEFAULTS.FEATURED_PRODUCT).success).toBe(false);
    expect(
      sectionSchemas.STEPS.safeParse({ heading: "x", steps: Array(7).fill({ title: "a" }) })
        .success,
    ).toBe(false);
  });
});

describe("homepage draft and publish", () => {
  let actorId: string;
  beforeEach(async () => {
    await resetDb();
    actorId = (await createUser({ roleId: (await createRole("Content editor")).id })).id;
    await testDb.homeSection.createMany({
      data: [
        { type: "HERO", position: 0, isVisible: true, data: { headline: "Welcome" } },
        { type: "TICKER", position: 1, isVisible: true, data: { items: ["Free delivery"] } },
        { type: "NEWSLETTER", position: 2, isVisible: true, data: { heading: "Join" } },
      ],
    });
  });

  const liveTypes = async () => (await loadPublishedSections(testDb)).map((s) => s.type);

  it("reordering and hiding change the live homepage only after publish", async () => {
    const [hero, ticker, news] = await listDraftSections(testDb);
    await reorderSections(testDb, [news.id, hero.id, ticker.id], actorId);
    await setSectionVisibility(testDb, { id: ticker.id, visible: false, actorId });

    expect(await liveTypes()).toEqual(["HERO", "TICKER", "NEWSLETTER"]);
    expect(await hasUnpublishedChanges(testDb)).toBe(true);

    await publishHomepage(testDb, actorId);
    expect(await liveTypes()).toEqual(["NEWSLETTER", "HERO"]);
    expect(await hasUnpublishedChanges(testDb)).toBe(false);
  });

  it("rejects invalid section data when saving a draft", async () => {
    const [hero] = await listDraftSections(testDb);
    await expect(
      saveSectionDraft(testDb, { id: hero.id, data: { headline: "" }, actorId }),
    ).rejects.toThrow(/headline/);
    await expect(
      saveSectionDraft(testDb, {
        id: hero.id,
        data: { headline: "Ok", buttonHref: "javascript:x" },
        actorId,
      }),
    ).rejects.toThrow(/buttonHref/);
    await saveSectionDraft(testDb, { id: hero.id, data: { headline: "New words" }, actorId });
    expect((await loadPublishedSections(testDb))[0].data).toEqual({ headline: "Welcome" });
  });

  it("new sections stay off the live page until published, and publish refuses invalid sections", async () => {
    const added = await addSection(testDb, "FEATURED_PRODUCT", actorId);
    expect(await liveTypes()).toEqual(["HERO", "TICKER", "NEWSLETTER"]);
    await expect(publishHomepage(testDb, actorId)).rejects.toThrow(/Featured product/);
    await removeSection(testDb, added.id, actorId);
    await publishHomepage(testDb, actorId);
    expect(await liveTypes()).toEqual(["HERO", "TICKER", "NEWSLETTER"]);
  });

  it("deleting a published section takes effect on publish; discard restores everything", async () => {
    const [, ticker] = await listDraftSections(testDb);
    await removeSection(testDb, ticker.id, actorId);
    await addSection(testDb, "STEPS", actorId);
    expect(await liveTypes()).toContain("TICKER");
    await discardHomepageDraft(testDb, actorId);
    expect((await listDraftSections(testDb)).map((s) => s.type)).toEqual([
      "HERO",
      "TICKER",
      "NEWSLETTER",
    ]);
    expect(await hasUnpublishedChanges(testDb)).toBe(false);
    await removeSection(testDb, ticker.id, actorId);
    await publishHomepage(testDb, actorId);
    expect(await liveTypes()).toEqual(["HERO", "NEWSLETTER"]);
  });
});
