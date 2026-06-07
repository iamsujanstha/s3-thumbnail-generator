import { NextResponse } from "next/server";
import { CreateProfileUseCase } from "@/core/use-cases/CreateProfileUseCase";
import { GetProfilesUseCase } from "@/core/use-cases/GetProfilesUseCase";
import { MongoProfileRepository } from "@/infrastructure/database/mongo/MongoProfileRepository";
import { S3StorageService } from "@/infrastructure/storage/s3/S3StorageService";
import { createProfileSchema } from "@/shared/dtos";
import { toThumbnailKey } from "@/shared/utils";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? 12);
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const includeOriginalFor = url.searchParams.get("expandedProfileId");

    const profileRepository = new MongoProfileRepository();
    const storage = new S3StorageService();
    const { profiles, nextCursor } = await new GetProfilesUseCase(profileRepository).execute({
      limit,
      cursor
    });

    const items = await Promise.all(
      profiles.map(async (profile) => {
        const thumbnailUrl = await storage.createGetUrl(toThumbnailKey(profile.imageKey));
        const originalUrl =
          includeOriginalFor === profile.id ? await storage.createGetUrl(profile.imageKey) : null;

        return {
          id: profile.id,
          fullName: profile.fullName,
          jobTitle: profile.jobTitle,
          company: profile.company,
          imageKey: profile.imageKey,
          thumbnailUrl,
          originalUrl,
          createdAt: profile.createdAt.toISOString()
        };
      })
    );

    return NextResponse.json({ profiles: items, nextCursor });
  } catch (error) {
    console.error("Failed to load profiles", error);
    return NextResponse.json({ error: "Unable to load profiles." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid profile request.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const profileRepository = new MongoProfileRepository();
    const profile = await new CreateProfileUseCase(profileRepository).execute(parsed.data);

    return NextResponse.json(
      {
        profile: {
          id: profile.id,
          fullName: profile.fullName,
          jobTitle: profile.jobTitle,
          company: profile.company,
          imageKey: profile.imageKey,
          createdAt: profile.createdAt.toISOString()
        }
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create profile", error);
    return NextResponse.json({ error: "Unable to create profile." }, { status: 500 });
  }
}
