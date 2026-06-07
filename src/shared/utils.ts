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
