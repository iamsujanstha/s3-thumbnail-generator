/**
 * AWS Lambda – On-the-Fly Image Resizing Origin
 * ─────────────────────────────────────────────────────────────
 * This function is triggered by CloudFront/API Gateway on a cache miss.
 * It dynamically processes images in-memory, avoiding the need to pre-generate
 * static thumbnails in S3.
 *
 * ARCHITECTURAL BENEFITS:
 * 1. Zero S3 Storage Waste: Only the original file is stored on S3.
 * 2. Infinite UI Flexibility: Frontend requests any dimension via query parameters.
 * 3. 100% In-Memory: No local disk write operations inside Lambda, maximizing speed.
 * 4. High CDN Cache Hit Rate: CloudFront caches the returned binary forever.
 * ─────────────────────────────────────────────────────────────
 */

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";

// Initialize S3 client. Lambda automatically uses the execution role credentials.
const s3 = new S3Client({});
const BUCKET_NAME = process.env.S3_BUCKET_NAME;

/**
 * Utility helper to convert S3 ReadStream into an in-memory Buffer.
 * S3 returns the image as a stream, which sharp needs as a buffer to perform operations.
 */
async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export const handler = async (event) => {
  // ── Step 1: Parse Request Parameters & Dimensions ────────────────
  // event.path contains the key (e.g. "/uploads/dynamic/file.jpg")
  const imageKey = event.path.replace(/^\//, ""); 
  
  // event.queryStringParameters contains ?w=100&h=100
  const queryParams = event.queryStringParameters || {};
  const width = parseInt(queryParams.w) || null;
  const height = parseInt(queryParams.h) || null;

  if (!imageKey) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Missing image path" }),
    };
  }

  try {
    // ── Step 2: Stream Original File from S3 ────────────────────────
    // We fetch the original private high-resolution image directly from S3.
    const s3Response = await s3.send(
      new GetObjectCommand({ Bucket: BUCKET_NAME, Key: imageKey })
    );
    // Convert S3 stream to buffer for memory processing
    const originalBuffer = await streamToBuffer(s3Response.Body);

    // ── Step 3: Dynamic Image Processing with Sharp ─────────────────
    // Load buffer into sharp pipeline
    let pipeline = sharp(originalBuffer);
    
    // Auto-rotate image based on metadata EXIF tags (e.g. camera orientation)
    pipeline = pipeline.rotate();

    // If dimensions are requested, resize using smart cropping ("cover")
    if (width || height) {
      pipeline = pipeline.resize(width, height, {
        fit: "cover",
        position: "attention",    // Uses visual attention mapping to keep faces/focal points in focus
        withoutEnlargement: true, // Prevents upscaling smaller images (prevents pixelation)
      });
    }

    // Convert the image format to modern WebP (which is 30% smaller than JPEG)
    const outputBuffer = await pipeline.webp({ quality: 80 }).toBuffer();

    // ── Step 4: Return Base64 Encoded Binary Response ───────────────
    // Lambda proxy integration requires returning binaries as Base64 strings.
    // CloudFront/API Gateway automatically decodes the Base64 back to image binary.
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "image/webp",
        // Cache-Control header tells CloudFront to cache this specific size forever (1 year)
        "Cache-Control": "public, max-age=31536000, immutable", 
      },
      body: outputBuffer.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (err) {
    console.error("Dynamic resizing failed:", err);
    return {
      // Return 404 if file does not exist, 500 for other errors
      statusCode: err.name === "NoSuchKey" ? 404 : 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Image processing failed" }),
    };
  }
};
