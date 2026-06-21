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

/** uploads/thumbnails/abc.jpg.webp  →  CloudFront URL or /api/img/... fallback */
export function toProxyUrl(s3Key: string): string {
  const cfUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_URL;
  if (cfUrl) {
    const baseUrl = cfUrl.endsWith("/") ? cfUrl.slice(0, -1) : cfUrl;
    return `${baseUrl}/${s3Key}`;
  }
  return `/api/img/${s3Key}`;
}

/** extracts "screenshot.png" from "uploads/raw/86e13213-cf01-4b6a-a7d3-c6d874eb81d1-screenshot.png" */
export function getOriginalFilename(imageKey: string): string {
  const filename = imageKey.split("/").pop();
  if (!filename) return "";
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i;
  if (uuidRegex.test(filename)) {
    return filename.replace(uuidRegex, "");
  }
  return filename;
}

