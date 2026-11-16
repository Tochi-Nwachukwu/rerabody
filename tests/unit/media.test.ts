import { beforeEach, describe, expect, it } from "vitest";

import { deleteMedia, registerUpload } from "@/server/services/media";
import type { StorageDriver } from "@/server/storage/types";

import { resetDb, testDb } from "../helpers/db";
import { createMedia, createProduct, createRole, createUser } from "../helpers/factories";

function fakeStorage(
  objects: Record<string, { contentLength: number; contentType: string }> = {},
): StorageDriver & { deleted: string[] } {
  const deleted: string[] = [];
  return {
    deleted,
    async presignPut() {
      return { url: "", method: "PUT", headers: {} };
    },
    async head(key) {
      return objects[key] ?? null;
    },
    async delete(key) {
      deleted.push(key);
    },
    publicUrl: (key) => `https://media.test/${key}`,
  };
}

describe("media", () => {
  let actorId: string;
  beforeEach(async () => {
    await resetDb();
    actorId = (await createUser({ roleId: (await createRole("Owner")).id })).id;
  });

  it("registers an upload only after checking the stored object", async () => {
    const key = "media/2026/11/0b7c2d3e-1111-4222-8333-944455566677.jpg";
    const storage = fakeStorage({ [key]: { contentLength: 1234, contentType: "image/jpeg" } });
    const m = await registerUpload(testDb, storage, { key, width: 10, height: 20, actorId });
    expect(m).toMatchObject({ key, bytes: 1234, url: `https://media.test/${key}` });
  });

  it("rejects client-chosen keys and oversized objects", async () => {
    await expect(
      registerUpload(testDb, fakeStorage(), { key: "evil/../x.jpg", actorId }),
    ).rejects.toThrow(/not valid/);
    const key = "media/2026/11/0b7c2d3e-1111-4222-8333-944455566678.png";
    const storage = fakeStorage({
      [key]: { contentLength: 9 * 1024 * 1024, contentType: "image/png" },
    });
    await expect(registerUpload(testDb, storage, { key, actorId })).rejects.toThrow(/8 MB/);
    expect(storage.deleted).toContain(key);
  });

  it("refuses to delete media used by a product or a homepage section (rule 11)", async () => {
    const used = await createMedia();
    const p = await createProduct();
    await testDb.productImage.create({
      data: { productId: p.id, mediaId: used.id, isCover: true },
    });
    await expect(deleteMedia(testDb, fakeStorage(), { mediaId: used.id, actorId })).rejects.toThrow(
      /in use/,
    );

    const inSection = await createMedia();
    await testDb.homeSection.create({
      data: { type: "HERO", position: 0, data: {}, draftData: { imageIds: [inSection.id] } },
    });
    await expect(
      deleteMedia(testDb, fakeStorage(), { mediaId: inSection.id, actorId }),
    ).rejects.toThrow(/Homepage section/);

    const free = await createMedia();
    const storage = fakeStorage();
    await deleteMedia(testDb, storage, { mediaId: free.id, actorId });
    expect(await testDb.media.findUnique({ where: { id: free.id } })).toBeNull();
    expect(storage.deleted).toEqual([free.key]);
  });
});
