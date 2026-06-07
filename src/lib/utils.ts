import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind class merging helper */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Strips special chars from a filename for safe S3 key usage */
export function sanitizeFilename(filename: string): string {
  return filename
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

/** uploads/raw/abc.jpg  →  uploads/thumbnails/abc.jpg.webp */
export function toThumbnailKey(rawKey: string): string {
  const filename = rawKey.split("/").pop();
  if (!filename) throw new Error("Invalid S3 key.");
  return `uploads/thumbnails/${filename}.webp`;
}

/** uploads/thumbnails/abc.jpg.webp  →  /api/img/uploads/thumbnails/abc.jpg.webp */
export function toProxyUrl(s3Key: string): string {
  return `/api/img/${s3Key}`;
}
