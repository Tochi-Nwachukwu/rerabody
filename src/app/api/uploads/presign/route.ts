import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { ALLOWED_IMAGE_TYPES, EXTENSION_FOR_TYPE, MAX_UPLOAD_BYTES } from "@/lib/media";
import { requirePermission } from "@/server/auth/session";
import { AuthError } from "@/server/errors";
import { getStorage } from "@/server/storage";

const bodySchema = z.object({
  contentType: z.enum(ALLOWED_IMAGE_TYPES),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

/**
 * Rule 10: session and media.upload checked, JPEG/PNG/WebP only, 8 MB cap,
 * object key generated here. The client never chooses the key.
 */
export async function POST(request: Request) {
  try {
    await requirePermission("media.upload");
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.code === "UNAUTHENTICATED" ? 401 : 403 },
      );
    }
    throw error;
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Images must be JPEG, PNG or WebP and 8 MB or smaller." },
      { status: 400 },
    );
  }

  const { contentType, size } = parsed.data;
  const now = new Date();
  const key = `media/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${EXTENSION_FOR_TYPE[contentType]}`;
  const upload = await getStorage().presignPut({ key, contentType, contentLength: size });
  return NextResponse.json({ key, ...upload });
}
