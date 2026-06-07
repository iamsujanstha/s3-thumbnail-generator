import { NextResponse } from "next/server";
import { MongoProfileRepository } from "@/infrastructure/database/mongo/MongoProfileRepository";
import { S3StorageService } from "@/infrastructure/storage/s3/S3StorageService";
import { UpdateProfileUseCase } from "@/core/use-cases/UpdateProfileUseCase";
import { DeleteProfileUseCase } from "@/core/use-cases/DeleteProfileUseCase";
import { updateProfileSchema } from "@/shared/dtos";
import { toThumbnailKey } from "@/shared/utils";

export const runtime = "nodejs";

// GET /api/profiles/:id — returns profile with both originalUrl and thumbnailUrl
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const profileRepository = new MongoProfileRepository();
    const profile = await profileRepository.findById(params.id);

    if (!profile) {
      return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    }

    const storage = new S3StorageService();
    const [originalUrl, thumbnailUrl] = await Promise.all([
      storage.createGetUrl(profile.imageKey),
      storage.createGetUrl(toThumbnailKey(profile.imageKey))
    ]);

    return NextResponse.json({
      id: profile.id,
      fullName: profile.fullName,
      jobTitle: profile.jobTitle,
      company: profile.company,
      imageKey: profile.imageKey,
      originalUrl,
      thumbnailUrl,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString()
    });
  } catch (error) {
    console.error("Failed to fetch profile", error);
    return NextResponse.json({ error: "Unable to fetch profile." }, { status: 500 });
  }
}

// PATCH /api/profiles/:id — update text fields only
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid update request.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const profileRepository = new MongoProfileRepository();
    const updated = await new UpdateProfileUseCase(profileRepository).execute(
      params.id,
      parsed.data
    );

    if (!updated) {
      return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    }

    return NextResponse.json({
      id: updated.id,
      fullName: updated.fullName,
      jobTitle: updated.jobTitle,
      company: updated.company,
      imageKey: updated.imageKey,
      updatedAt: updated.updatedAt.toISOString()
    });
  } catch (error) {
    console.error("Failed to update profile", error);
    return NextResponse.json({ error: "Unable to update profile." }, { status: 500 });
  }
}

// DELETE /api/profiles/:id
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const profileRepository = new MongoProfileRepository();
    const deleted = await new DeleteProfileUseCase(profileRepository).execute(params.id);

    if (!deleted) {
      return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete profile", error);
    return NextResponse.json({ error: "Unable to delete profile." }, { status: 500 });
  }
}
