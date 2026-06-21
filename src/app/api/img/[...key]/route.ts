import { NextResponse } from "next/server";
import { S3Service } from "@/modules/aws/S3.service";

export const runtime = "nodejs";

type Ctx = { params: { key: string[] } };

export async function GET(req: Request, { params }: Ctx) {
  const s3Key = params.key.join("/");
  if (!s3Key) return NextResponse.json({ error: "Missing key." }, { status: 400 });

  const ifNoneMatch = req.headers.get("if-none-match");
  const isThumbnail = s3Key.startsWith("uploads/thumbnails/");
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

    const headers: Record<string, string> = {
      "Content-Type": result.contentType,
      "Cache-Control": cacheControl,
      "Vary": "",
    };
    if (result.etag) headers["ETag"] = result.etag;

    return new NextResponse(result.buffer, { status: 200, headers });
  } catch (err) {
    console.error("[img-proxy]", { s3Key, err });
    return NextResponse.json({ error: "Failed to load image." }, { status: 502 });
  }
}
