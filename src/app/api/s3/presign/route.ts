import { NextResponse } from "next/server";
import { GetPresignedUrlUseCase } from "@/core/use-cases/GetPresignedUrlUseCase";
import { S3StorageService } from "@/infrastructure/storage/s3/S3StorageService";
import { presignUploadSchema } from "@/shared/dtos";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = presignUploadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid upload request.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const useCase = new GetPresignedUrlUseCase(new S3StorageService());
    const result = await useCase.execute(parsed.data);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to create S3 presigned URL:", message, error);

    // In development, expose the real error to help diagnose issues
    if (process.env.NODE_ENV === "development") {
      return NextResponse.json({ error: "Unable to prepare upload.", detail: message }, { status: 500 });
    }

    return NextResponse.json({ error: "Unable to prepare upload." }, { status: 500 });
  }
}
