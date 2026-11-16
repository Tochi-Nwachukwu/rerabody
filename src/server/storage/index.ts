import "server-only";

import { env } from "@/env";

import { createLocalStorage } from "./local";
import { createR2Storage } from "./r2";
import type { StorageDriver } from "./types";

let driver: StorageDriver | undefined;

export function getStorage(): StorageDriver {
  driver ??=
    env.STORAGE_DRIVER === "local"
      ? createLocalStorage(env.BETTER_AUTH_SECRET)
      : createR2Storage({
          accountId: env.R2_ACCOUNT_ID,
          accessKeyId: env.R2_ACCESS_KEY_ID,
          secretAccessKey: env.R2_SECRET_ACCESS_KEY,
          bucket: env.R2_BUCKET,
          publicBaseUrl: env.NEXT_PUBLIC_MEDIA_URL,
        });
  return driver;
}

export type { StorageDriver };
