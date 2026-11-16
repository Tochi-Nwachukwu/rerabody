import { beforeEach, describe, expect, it } from "vitest";

import { deletePage, publishPage, savePageDraft } from "@/server/services/content";
import { subscribe } from "@/server/services/newsletter";
import { saveSetting } from "@/server/services/settings";

import { resetDb, testDb } from "../helpers/db";
import { createRole, createUser } from "../helpers/factories";

const body = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

describe("pages, settings and newsletter", () => {
  let actorId: string;
  beforeEach(async () => {
    await resetDb();
    actorId = (await createUser({ roleId: (await createRole("Owner")).id })).id;
  });

  it("keeps edits in the draft until published", async () => {
    const page = await savePageDraft(testDb, {
      slug: "about",
      title: "About",
      draftBody: body("v1"),
      metaTitle: null,
      metaDescription: null,
      actorId,
    });
    expect(page.publishedAt).toBeNull();
    await publishPage(testDb, { id: page.id, actorId });
    await savePageDraft(testDb, {
      id: page.id,
      slug: "about",
      title: "About",
      draftBody: body("v2"),
      metaTitle: null,
      metaDescription: null,
      actorId,
    });
    const after = await testDb.page.findUniqueOrThrow({ where: { id: page.id } });
    expect(after.body).toEqual(body("v1"));
    expect(after.draftBody).toEqual(body("v2"));
  });

  it("refuses reserved slugs and deleting system pages", async () => {
    await expect(
      savePageDraft(testDb, {
        slug: "checkout",
        title: "x",
        draftBody: null,
        metaTitle: null,
        metaDescription: null,
        actorId,
      }),
    ).rejects.toThrow(/used by another part/);
    const terms = await savePageDraft(testDb, {
      slug: "terms",
      title: "Terms",
      draftBody: body("x"),
      metaTitle: null,
      metaDescription: null,
      actorId,
    });
    await expect(deletePage(testDb, { id: terms.id, actorId })).rejects.toThrow(
      /cannot be deleted/,
    );
    await expect(
      savePageDraft(testDb, {
        id: terms.id,
        slug: "terms-2",
        title: "Terms",
        draftBody: null,
        metaTitle: null,
        metaDescription: null,
        actorId,
      }),
    ).rejects.toThrow(/cannot change/);
  });

  it("validates settings with their schema", async () => {
    await expect(
      saveSetting(testDb, "seo", { defaultTitle: "x".repeat(80) }, actorId),
    ).rejects.toThrow();
    await saveSetting(
      testDb,
      "seo",
      { defaultTitle: "Rera", defaultDescription: "Body butters" },
      actorId,
    );
    expect((await testDb.siteSetting.findUniqueOrThrow({ where: { key: "seo" } })).value).toEqual({
      defaultTitle: "Rera",
      defaultDescription: "Body butters",
    });
  });

  it("subscribing twice returns the same subscriber and re-subscribes after an unsubscribe", async () => {
    const first = await subscribe(testDb, "News@Example.test");
    const second = await subscribe(testDb, "news@example.test");
    expect(second.subscriber.id).toBe(first.subscriber.id);
    expect(second.isNew).toBe(false);
    await testDb.newsletterSubscriber.update({
      where: { id: first.subscriber.id },
      data: { status: "UNSUBSCRIBED" },
    });
    await subscribe(testDb, "news@example.test");
    expect(
      (await testDb.newsletterSubscriber.findUniqueOrThrow({ where: { id: first.subscriber.id } }))
        .status,
    ).toBe("SUBSCRIBED");
  });
});
