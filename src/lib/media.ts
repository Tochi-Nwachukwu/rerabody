export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export const EXTENSION_FOR_TYPE: Record<AllowedImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function isAllowedImageType(type: string): type is AllowedImageType {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(type);
}

/** Object keys are always generated on the server in this shape (rule 10). */
export const MEDIA_KEY_PATTERN = /^media\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp)$/;
