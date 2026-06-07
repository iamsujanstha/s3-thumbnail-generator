import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function sanitizeFilename(filename: string) {
  return filename
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function toThumbnailKey(rawKey: string) {
  const filename = rawKey.split("/").pop();
  if (!filename) {
    throw new Error("Invalid raw S3 key.");
  }

  return `uploads/thumbnails/${filename}.webp`;
}

/**
 * Convert an S3 key to a stable same-origin proxy URL.
 *
 * Instead of returning an expiring presigned URL (which is a different
 * string on every API call → browser sees a new src → re-downloads the
 * image even though the bytes haven't changed), we route all images
 * through /api/img/[...key].
 *
 * That route streams the S3 object and responds with long Cache-Control
 * headers, so the browser caches the image permanently by its stable URL.
 *
 *   uploads/thumbnails/abc.webp  →  /api/img/uploads/thumbnails/abc.webp
 *   uploads/raw/abc.jpg          →  /api/img/uploads/raw/abc.jpg
 */
export function toProxyUrl(s3Key: string): string {
  return `/api/img/${s3Key}`;
}
