import { NextResponse } from "next/server";
import { S3Service } from "@/modules/aws/S3.service";
import sharp from "sharp";

export const runtime = "nodejs";

type Ctx = { params: { key: string[] } };

// Production-grade security: Strict allowlist of target resizing dimensions to prevent CPU exhaustion/billing attacks
const ALLOWED_WIDTHS = new Set([40, 100, 150, 225, 300, 450, 600]);
const ALLOWED_HEIGHTS = new Set([40, 100, 150, 225, 300, 450, 600]);

// Production-grade security: Strict S3 path prefixes allowed to be read via the proxy to prevent bucket directory leakage
const ALLOWED_PREFIXES = ["uploads/raw/", "uploads/thumbnails/", "uploads/dynamic/"];

export async function GET(req: Request, { params }: Ctx) {
  const s3Key = params.key.join("/");
  if (!s3Key) return NextResponse.json({ error: "Missing key." }, { status: 400 });

  // 1. Path prefix restriction (prevent access to raw private configs/backups inside S3)
  const isPathAllowed = ALLOWED_PREFIXES.some((prefix) => s3Key.startsWith(prefix));
  if (!isPathAllowed) {
    console.warn(`[img-proxy] Blocked unauthorized S3 key access attempt: ${s3Key}`);
    return NextResponse.json({ error: "Access Denied: Unauthorized key path." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const width = parseInt(searchParams.get("w") || "") || null;
  const height = parseInt(searchParams.get("h") || "") || null;

  // 2. Dynamic parameter validation (prevent CPU-burn DDoS by restricting resizing bounds)
  if ((width !== null && !ALLOWED_WIDTHS.has(width)) || (height !== null && !ALLOWED_HEIGHTS.has(height))) {
    console.warn(`[img-proxy] Blocked unauthorized resize dimensions w=${width}, h=${height}`);
    return NextResponse.json({ error: "Access Denied: Unsupported dimensions." }, { status: 400 });
  }

  const ifNoneMatch = req.headers.get("if-none-match");
  
  // Set Cache-Control. If it's a dynamic resized or thumbnail, allow long caching.
  const isThumbnail = s3Key.startsWith("uploads/thumbnails/") || s3Key.startsWith("uploads/dynamic/") || width !== null || height !== null;
  const cacheControl = isThumbnail
    ? "public, max-age=31536000, s-maxage=31536000, immutable"
    : "public, max-age=600, s-maxage=600, must-revalidate";

  try {
    const result = await S3Service.streamFromS3(s3Key, ifNoneMatch);

    if (result.kind === "not_found") {
      return NextResponse.json({ error: "Image not found." }, { status: 404 });
    }

    if (result.kind === "not_modified") {
      return new NextResponse(null, {
        status: 304,
        headers: { "Cache-Control": cacheControl, ...(result.etag ? { ETag: result.etag } : {}) },
      });
    }

    let buffer: any = result.buffer;
    let contentType = result.contentType;

    // Perform on-the-fly resizing inside Next.js using Sharp
    if (width || height) {
      try {
        let pipeline = sharp(result.buffer).rotate();
        
        pipeline = pipeline.resize(width, height, {
          fit: "cover",
          position: "attention",
          withoutEnlargement: true,
        });

        buffer = await pipeline.webp({ quality: 80 }).toBuffer();
        contentType = "image/webp";
      } catch (sharpErr) {
        console.error("[img-proxy] Sharp resizing failed:", sharpErr);
        // Fall back to original file if resizing fails
      }
    }

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": cacheControl,
      "Vary": "Accept-Encoding",
    };
    if (result.etag) headers["ETag"] = result.etag;

    return new NextResponse(buffer, { status: 200, headers });
  } catch (err) {
    console.error("[img-proxy] API Route error:", { s3Key, err });
    return NextResponse.json({ error: "Failed to load image." }, { status: 502 });
  }
}
