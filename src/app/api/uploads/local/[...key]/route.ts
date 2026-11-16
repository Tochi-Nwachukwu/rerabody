import { NextResponse } from "next/server";

import { env } from "@/env";
import { contentTypeForKey, readLocalObject } from "@/server/storage/local";

/** Serves files written by the local storage driver. Only active with STORAGE_DRIVER=local. */
export async function GET(_request: Request, ctx: RouteContext<"/api/uploads/local/[...key]">) {
  if (env.STORAGE_DRIVER !== "local") return new NextResponse(null, { status: 404 });
  const { key } = await ctx.params;
  const objectKey = key.join("/");
  const body = await readLocalObject(objectKey).catch(() => null);
  if (!body) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": contentTypeForKey(objectKey),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
