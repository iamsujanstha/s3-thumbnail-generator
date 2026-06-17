import { randomUUID } from "crypto";
import { ProfilesRepository } from "@/modules/profiles/profiles.repository";
import { StorageService } from "@/modules/storage/storage.service";
import { sanitizeFilename, toThumbnailKey, toProxyUrl } from "@/lib/utils";
import type {
  CreateProfileDto,
  UpdateProfileDto,
  PresignUploadDto,
  ListQueryDto,
  InitiateMultipartDto,
  CompleteMultipartDto,
} from "@/modules/profiles/profiles.schema";
import type { ProfileListItemDto, ProfileDetailDto } from "@/types/dtos";

export const ProfilesService = {
  // ── List profiles ───────────────────────────────────────────────
  async list(query: ListQueryDto) {
    const { profiles, nextCursor } = await ProfilesRepository.findMany({
      limit:  query.limit,
      cursor: query.cursor,
    });

    return {
      profiles: profiles.map((p) => ({
        id:           p.id,
        fullName:     p.fullName,
        jobTitle:     p.jobTitle,
        company:      p.company,
        imageKey:     p.imageKey,
        thumbnailUrl: toProxyUrl(toThumbnailKey(p.imageKey)),
        createdAt:    p.createdAt.toISOString(),
      } satisfies ProfileListItemDto)),
      nextCursor,
    };
  },

  // ── Get single profile ──────────────────────────────────────────
  async getById(id: string): Promise<ProfileDetailDto | null> {
    const profile = await ProfilesRepository.findById(id);
    if (!profile) return null;

    const thumbnailKey    = toThumbnailKey(profile.imageKey);
    const thumbnailExists = await StorageService.keyExists(thumbnailKey).catch(() => false);

    return {
      id:           profile.id,
      fullName:     profile.fullName,
      jobTitle:     profile.jobTitle,
      company:      profile.company,
      imageKey:     profile.imageKey,
      originalUrl:  toProxyUrl(profile.imageKey),
      thumbnailUrl: thumbnailExists
        ? toProxyUrl(thumbnailKey)
        : toProxyUrl(profile.imageKey),
      createdAt:    profile.createdAt.toISOString(),
      updatedAt:    profile.updatedAt.toISOString(),
    };
  },

  // ── Create profile ──────────────────────────────────────────────
  async create(data: CreateProfileDto) {
    const profile = await ProfilesRepository.create(data);
    
    // Remove the cleanup tag so S3 lifecycle rule does not delete the original image
    StorageService.removeCleanupTag(data.imageKey).catch((err) => {
      console.warn(`[ProfilesService.create] Failed to remove S3 cleanup tag for key ${data.imageKey}:`, err);
    });

    return profile;
  },

  // ── Update profile ──────────────────────────────────────────────
  async update(id: string, data: UpdateProfileDto) {
    return ProfilesRepository.update(id, data);
  },

  // ── Delete profile ──────────────────────────────────────────────
  async delete(id: string): Promise<boolean> {
    return ProfilesRepository.delete(id);
  },

  // ── Presign S3 upload URL ───────────────────────────────────────
  async presignUpload(data: PresignUploadDto) {
    const imageKey  = `uploads/raw/${randomUUID()}-${sanitizeFilename(data.filename)}`;
    const uploadUrl = await StorageService.createPutUrl({
      key:         imageKey,
      contentType: data.contentType,
      contentMd5:  data.contentMd5,
    });
    return { uploadUrl, imageKey };
  },

  // ── Initiate Multipart Upload ───────────────────────────────────
  async initiateMultipart(data: InitiateMultipartDto) {
    const imageKey = `uploads/raw/${randomUUID()}-${sanitizeFilename(data.filename)}`;
    const uploadId = await StorageService.initiateMultipartUpload(imageKey, data.contentType);
    
    // Chunk size: 5MB minimum
    const chunkSize = 5 * 1024 * 1024;
    const numParts  = Math.ceil(data.size / chunkSize);
    
    const partPromises = Array.from({ length: numParts }, (_, i) => {
      const partNumber = i + 1;
      return StorageService.createUploadPartUrl({
        key:        imageKey,
        uploadId,
        partNumber,
      }).then((uploadUrl) => ({
        partNumber,
        uploadUrl,
      }));
    });

    const parts = await Promise.all(partPromises);

    return {
      uploadId,
      key: imageKey,
      parts,
    };
  },

  // ── Complete Multipart Upload ───────────────────────────────────
  async completeMultipart(data: CompleteMultipartDto) {
    await StorageService.completeMultipartUpload({
      key:      data.key,
      uploadId: data.uploadId,
      parts:    data.parts,
    });
  },

  async deleteTempFile(key: string) {
    await StorageService.deleteObject(key);
  },
};
