/**
 * S3 → Lambda Thumbnail Generator
 * ─────────────────────────────────────────────────────────────
 * Drop-in reusable for any project.
 *
 * CONFIGURE these two constants for your project:
 *   RAW_PREFIX       – S3 prefix where original uploads land
 *   THUMB_PREFIX     – S3 prefix where thumbnails are written
 *
 * THUMBNAIL settings (width, height, quality) are at the bottom
 * of the CONFIG block — change once, works everywhere.
 * ─────────────────────────────────────────────────────────────
 */

// ─── CONFIG (edit these for each project) ────────────────────
const RAW_PREFIX   = "uploads/raw/";       // must end with /
const THUMB_PREFIX = "uploads/thumbnails/"; // must end with /
const THUMB_EXT    = ".webp";              // output extension appended to original filename
const THUMB_WIDTH  = 150;                  // px
const THUMB_HEIGHT = 150;                  // px
const THUMB_QUALITY = 78;                  // 1-100
// ─────────────────────────────────────────────────────────────

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";

// Lambda execution role provides credentials automatically — no keys needed
const s3 = new S3Client({});

/** Convert a readable stream to a Buffer */
async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Derive the thumbnail S3 key from the raw upload key.
 * Returns null if the key doesn't belong to RAW_PREFIX (skip safely).
 *
 * Example:
 *   uploads/raw/abc-photo.jpg  →  uploads/thumbnails/abc-photo.jpg.webp
 */
function getThumbnailKey(rawKey) {
  const decodedKey = decodeURIComponent(rawKey.replace(/\+/g, " "));
  if (!decodedKey.startsWith(RAW_PREFIX)) return null;

  const filename = decodedKey.split("/").pop();
  if (!filename) return null;

  return {
    rawKey: decodedKey,
    thumbnailKey: `${THUMB_PREFIX}${filename}${THUMB_EXT}`
  };
}

export const handler = async (event) => {
  const results = [];

  for (const record of event.Records ?? []) {
    const bucket  = record.s3?.bucket?.name;
    const keyInfo = getThumbnailKey(record.s3?.object?.key ?? "");

    if (!bucket || !keyInfo) {
      results.push({ status: "skipped", reason: "unsupported-record" });
      continue;
    }

    try {
      // 1. Download the original from S3
      const object = await s3.send(
        new GetObjectCommand({ Bucket: bucket, Key: keyInfo.rawKey })
      );

      if (!object.Body) throw new Error(`Empty body for ${keyInfo.rawKey}`);

      const sourceBuffer = await streamToBuffer(object.Body);

      // 2. Resize + convert with sharp
      const thumbnail = await sharp(sourceBuffer, { failOn: "none" })
        .rotate()                          // auto-rotate via EXIF
        .resize(THUMB_WIDTH, THUMB_HEIGHT, {
          fit: "cover",
          position: "attention",           // smart crop — keeps faces/focal points
          withoutEnlargement: true
        })
        .webp({ quality: THUMB_QUALITY, effort: 4 })
        .toBuffer();

      // 3. Upload thumbnail back to S3
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: keyInfo.thumbnailKey,
          Body: thumbnail,
          ContentType: "image/webp",
          CacheControl: "public, max-age=31536000, immutable",
          Metadata: { source: keyInfo.rawKey }
        })
      );

      results.push({
        status: "created",
        sourceKey: keyInfo.rawKey,
        thumbnailKey: keyInfo.thumbnailKey
      });

      console.log(`Thumbnail created: ${keyInfo.thumbnailKey}`);
    } catch (error) {
      console.error("Thumbnail generation failed", { bucket, key: keyInfo.rawKey, error });
      throw error; // re-throw so Lambda marks the invocation as failed
    }
  }

  return { results };
};
