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
