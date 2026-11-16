import { NextResponse } from "next/server";

import { env } from "@/env";
import { MAX_UPLOAD_BYTES } from "@/lib/media";
import { verifyLocalUpload, writeLocalObject } from "@/server/storage/local";

/** Local stand-in for an R2 presigned PUT. Only active with STORAGE_DRIVER=local. */
export async function PUT(request: Request) {
  if (env.STORAGE_DRIVER !== "local") return new NextResponse(null, { status: 404 });
  const url = new URL(request.url);
  const params = {
    key: url.searchParams.get("key") ?? "",
    contentType: url.searchParams.get("contentType") ?? "",
    contentLength: Number(url.searchParams.get("contentLength")),
    expires: Number(url.searchParams.get("expires")),
    signature: url.searchParams.get("signature") ?? "",
  };
  if (!verifyLocalUpload(env.BETTER_AUTH_SECRET, params)) {
    return NextResponse.json({ error: "Invalid or expired upload URL" }, { status: 403 });
  }
  if (request.headers.get("content-type") !== params.contentType) {
    return NextResponse.json(
      { error: "Content type does not match the signed upload" },
      { status: 400 },
    );
  }
  const body = Buffer.from(await request.arrayBuffer());
  if (body.length !== params.contentLength || body.length > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Size does not match the signed upload" }, { status: 400 });
  }
  await writeLocalObject(params.key, body);
  return new NextResponse(null, { status: 200 });
}
