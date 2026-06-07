/**
 * GET /api/img/[...key]
 * ─────────────────────────────────────────────────────────────
 * Image proxy — streams S3 objects through Next.js so the browser
 * always hits a stable same-origin URL instead of an expiring
 * presigned URL.
 *
 * Cache strategy:
 *   Thumbnails  → immutable, 1 year  (content-addressed UUID key)
 *   Originals   → 10 min + must-revalidate
 *
 * The ETag from S3 is forwarded so the browser can do 304
 * conditional requests instead of full re-downloads.
 */

import { NextResponse } from "next/server";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getServerEnv } from "@/shared/env";

export const runtime = "nodejs";

// Module-level singleton — reused across Lambda invocations / requests
let _s3: S3Client | undefined;
function s3(): S3Client {
  if (!_s3) {
    const env = getServerEnv();
    _s3 = new S3Client({
      region: env.AWS_REGION,
      requestChecksumCalculation: "WHEN_REQUIRED",
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return _s3;
}

function inferContentType(key: string, s3ContentType?: string): string {
  if (s3ContentType) return s3ContentType;
  if (key.endsWith(".webp")) return "image/webp";
  if (key.endsWith(".png"))  return "image/png";
  if (key.endsWith(".gif"))  return "image/gif";
  return "image/jpeg";
}

export async function GET(
  req: Request,
  { params }: { params: { key: string[] } }
) {
  const s3Key = params.key.join("/");
  if (!s3Key) {
    return NextResponse.json({ error: "Missing key." }, { status: 400 });
  }

  const isThumbnail = s3Key.startsWith("uploads/thumbnails/");
  const env = getServerEnv();

  try {
    const result = await s3().send(
      new GetObjectCommand({ Bucket: env.S3_BUCKET_NAME, Key: s3Key })
    );

    if (!result.Body) {
      return NextResponse.json({ error: "Empty object." }, { status: 404 });
    }

    // Forward ETag from S3 — enables 304 Not Modified on repeated requests
    const etag = result.ETag ?? undefined;

    // Handle conditional request — browser sends If-None-Match after first load
    const ifNoneMatch = req.headers.get("if-none-match");
    if (etag && ifNoneMatch && ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          "Cache-Control": isThumbnail
            ? "public, max-age=31536000, immutable"
            : "public, max-age=600, must-revalidate",
          "ETag": etag,
        },
      });
    }

    // Read body into buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of result.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    const contentType = inferContentType(s3Key, result.ContentType);
    const cacheControl = isThumbnail
      ? "public, max-age=31536000, s-maxage=31536000, immutable"
      : "public, max-age=600, s-maxage=600, must-revalidate";

    const headers: Record<string, string> = {
      "Content-Type":  contentType,
      "Cache-Control": cacheControl,
      "Vary":          "",           // no variation — same URL = same bytes
    };
    if (etag) headers["ETag"] = etag;

    return new NextResponse(buffer, { status: 200, headers });

  } catch (err: unknown) {
    const name = (err as { name?: string }).name ?? "";
    const code = (err as { Code?: string }).Code ?? "";
    const status = (err as { $metadata?: { httpStatusCode?: number } })
      ?.$metadata?.httpStatusCode;

    if (
      name === "NoSuchKey" || code === "NoSuchKey" ||
      name === "NotFound"  || code === "NotFound"  ||
      status === 404
    ) {
      return NextResponse.json({ error: "Image not found." }, { status: 404 });
    }

    console.error("[img-proxy] S3 fetch failed", { s3Key, err });
    return NextResponse.json({ error: "Failed to load image." }, { status: 502 });
  }
}
