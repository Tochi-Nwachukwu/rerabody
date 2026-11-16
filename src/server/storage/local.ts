import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { EXTENSION_FOR_TYPE, MEDIA_KEY_PATTERN } from "@/lib/media";

import type { StorageDriver } from "./types";

/**
 * Development and test stand-in for R2. Files live in .uploads/ and are served
 * by /api/uploads/local. Uploads use a short-lived HMAC-signed URL, like a presigned PUT.
 */
export const LOCAL_UPLOAD_ROOT = path.join(process.cwd(), ".uploads");
export const LOCAL_PUBLIC_PREFIX = "/api/uploads/local";

function sign(
  secret: string,
  key: string,
  contentType: string,
  contentLength: number,
  expires: number,
) {
  return createHmac("sha256", secret)
    .update(`${key}|${contentType}|${contentLength}|${expires}`)
    .digest("hex");
}

export function verifyLocalUpload(
  secret: string,
  params: {
    key: string;
    contentType: string;
    contentLength: number;
    expires: number;
    signature: string;
  },
): boolean {
  if (!MEDIA_KEY_PATTERN.test(params.key) || Date.now() > params.expires) return false;
  const expected = Buffer.from(
    sign(secret, params.key, params.contentType, params.contentLength, params.expires),
  );
  const given = Buffer.from(params.signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

function filePath(key: string) {
  if (!MEDIA_KEY_PATTERN.test(key)) throw new Error("Invalid media key");
  return path.join(LOCAL_UPLOAD_ROOT, key);
}

export async function writeLocalObject(key: string, body: Buffer) {
  const file = filePath(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
}

export async function readLocalObject(key: string): Promise<Buffer | null> {
  try {
    return await readFile(filePath(key));
  } catch {
    return null;
  }
}

export function contentTypeForKey(key: string): string {
  const ext = key.split(".").pop();
  const entry = Object.entries(EXTENSION_FOR_TYPE).find(([, e]) => e === ext);
  return entry?.[0] ?? "application/octet-stream";
}

export function createLocalStorage(secret: string): StorageDriver {
  return {
    async presignPut({ key, contentType, contentLength }) {
      const expires = Date.now() + 5 * 60 * 1000;
      const signature = sign(secret, key, contentType, contentLength, expires);
      const qs = new URLSearchParams({
        key,
        contentType,
        contentLength: String(contentLength),
        expires: String(expires),
        signature,
      });
      return {
        url: `${LOCAL_PUBLIC_PREFIX}?${qs}`,
        method: "PUT",
        headers: { "Content-Type": contentType },
      };
    },
    async head(key) {
      try {
        const s = await stat(filePath(key));
        return { contentLength: s.size, contentType: contentTypeForKey(key) };
      } catch {
        return null;
      }
    },
    async delete(key) {
      await rm(filePath(key), { force: true });
    },
    publicUrl(key) {
      return `${LOCAL_PUBLIC_PREFIX}/${key}`;
    },
  };
}
