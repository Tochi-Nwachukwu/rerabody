import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type { StorageDriver } from "./types";

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
};

/** Cloudflare R2 through the S3-compatible API. Reads are served from the public custom domain. */
export function createR2Storage(config: R2Config): StorageDriver {
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  const base = config.publicBaseUrl.replace(/\/$/, "");

  return {
    async presignPut({ key, contentType, contentLength }) {
      // Content type and length are part of the signature, so the client cannot change them.
      const command = new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        ContentType: contentType,
        ContentLength: contentLength,
      });
      const url = await getSignedUrl(client, command, {
        expiresIn: 300,
        signableHeaders: new Set(["content-type", "content-length"]),
      });
      return { url, method: "PUT", headers: { "Content-Type": contentType } };
    },
    async head(key) {
      try {
        const res = await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
        return { contentLength: res.ContentLength ?? 0, contentType: res.ContentType ?? null };
      } catch (error) {
        if ((error as { name?: string }).name === "NotFound") return null;
        throw error;
      }
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
    },
    publicUrl(key) {
      return `${base}/${key}`;
    },
  };
}
