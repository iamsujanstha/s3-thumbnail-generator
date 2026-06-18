import { Injectable, NotFoundException } from '@nestjs/common';
import { ProfilesRepository } from './profiles.repository';
import { StorageService } from '../storage/storage.service';
import { CreateProfileDto, UpdateProfileDto, ListProfilesQueryDto } from './dto/profiles.dto';

@Injectable()
export class ProfilesService {
  constructor(
    private readonly profilesRepository: ProfilesRepository,
    private readonly storageService: StorageService,
  ) {}

  // ── Helper Url Mapping Functions ──────────────────────────────
  private toThumbnailKey(rawKey: string): string {
    const filename = rawKey.split('/').pop();
    if (!filename) throw new Error('Invalid S3 key.');
    return `uploads/thumbnails/${filename}.webp`;
  }

  private toProxyUrl(s3Key: string): string {
    // Points to the Server-Side Image Proxy controller route
    return `/s3/images/${s3Key}`;
  }

  // ── List Profiles ───────────────────────────────────────────────
  async list(query: ListProfilesQueryDto) {
    const { profiles, nextCursor } = await this.profilesRepository.findMany({
      limit: query.limit,
      cursor: query.cursor,
    });

    return {
      profiles: profiles.map((p) => ({
        id: p._id.toString(),
        fullName: p.fullName,
        jobTitle: p.jobTitle,
        company: p.company,
        imageKey: p.imageKey,
        thumbnailUrl: this.toProxyUrl(this.toThumbnailKey(p.imageKey)),
        createdAt: p.createdAt.toISOString(),
      })),
      nextCursor,
    };
  }

  // ── Get Single Profile ──────────────────────────────────────────
  async getById(id: string) {
    const profile = await this.profilesRepository.findById(id);
    if (!profile) {
      throw new NotFoundException(`Profile with ID ${id} not found.`);
    }

    const thumbnailKey = this.toThumbnailKey(profile.imageKey);
    const thumbnailExists = await this.storageService.keyExists(thumbnailKey).catch(() => false);

    return {
      id: profile._id.toString(),
      fullName: profile.fullName,
      jobTitle: profile.jobTitle,
      company: profile.company,
      imageKey: profile.imageKey,
      originalUrl: this.toProxyUrl(profile.imageKey),
      thumbnailUrl: thumbnailExists
        ? this.toProxyUrl(thumbnailKey)
        : this.toProxyUrl(profile.imageKey),
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }

  // ── Create Profile ──────────────────────────────────────────────
  async create(data: CreateProfileDto) {
    const profile = await this.profilesRepository.create(data);

    // Remove the cleanup tag so S3 lifecycle rule does not delete the original image
    this.storageService.removeCleanupTag(data.imageKey).catch((err) => {
      console.warn(
        `[ProfilesService.create] Failed to remove S3 cleanup tag for key ${data.imageKey}:`,
        err,
      );
    });

    return {
      id: profile._id.toString(),
      fullName: profile.fullName,
      jobTitle: profile.jobTitle,
      company: profile.company,
      imageKey: profile.imageKey,
    };
  }

  // ── Update Profile ──────────────────────────────────────────────
  async update(id: string, data: UpdateProfileDto) {
    const profile = await this.profilesRepository.update(id, data);
    if (!profile) {
      throw new NotFoundException(`Profile with ID ${id} not found.`);
    }
    return profile;
  }

  // ── Delete Profile ──────────────────────────────────────────────
  async delete(id: string): Promise<boolean> {
    const profile = await this.profilesRepository.findById(id);
    if (!profile) {
      throw new NotFoundException(`Profile with ID ${id} not found.`);
    }

    // Optional: Delete original S3 image and thumbnail upon deletion:
    // await this.storageService.deleteObject(profile.imageKey).catch(() => {});
    // await this.storageService.deleteObject(this.toThumbnailKey(profile.imageKey)).catch(() => {});

    return this.profilesRepository.delete(id);
  }
}
