import { MAX_UPLOAD_BYTES, isAllowedImageType } from "@/lib/media";
import { registerUploadAction } from "@/server/actions/media";

export type MediaItem = {
  id: string;
  url: string;
  alt: string | null;
  width: number | null;
  height: number | null;
};

async function readDimensions(file: File): Promise<{ width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const dims = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dims;
  } catch {
    return null;
  }
}

function put(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress: (pct: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection."));
    xhr.send(file);
  });
}

/** Presign on the server, PUT straight to storage with progress, then register the Media row. */
export async function uploadImage(
  file: File,
  onProgress: (pct: number) => void = () => {},
): Promise<MediaItem> {
  if (!isAllowedImageType(file.type))
    throw new Error(`${file.name}: only JPEG, PNG and WebP images are allowed.`);
  if (file.size > MAX_UPLOAD_BYTES)
    throw new Error(`${file.name}: images must be 8 MB or smaller.`);

  const dims = await readDimensions(file);
  const res = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType: file.type, size: file.size }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    key?: string;
    url?: string;
    headers?: Record<string, string>;
    error?: string;
  };
  if (!res.ok || !body.key || !body.url)
    throw new Error(body.error ?? "Could not start the upload.");

  await put(body.url, file, body.headers ?? { "Content-Type": file.type }, onProgress);
  const result = await registerUploadAction({
    key: body.key,
    width: dims?.width,
    height: dims?.height,
    alt: null,
  });
  if (!result.ok) throw new Error(result.error);
  return result.data;
}
