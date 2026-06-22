import { randomUUID } from "crypto";
import { ProfilesRepository } from "@/modules/profiles/profiles.repository";
import { S3Service } from "@/modules/aws/S3.service";
import { sanitizeFilename, toThumbnailKey, toProxyUrl } from "@/lib/utils";
import {
  MAX_IMAGE_SIZE,
  type CreateProfileDto,
  type UpdateProfileDto,
  type PresignUploadDto,
  type ListQueryDto,
  type InitiateMultipartDto,
  type CompleteMultipartDto,
} from "@/modules/profiles/profiles.schema";
import type { ProfileListItemDto, ProfileDetailDto } from "@/types/dtos";

export const ProfilesService = {
  // ── List profiles ───────────────────────────────────────────────
  async list(query: ListQueryDto) {
    const { profiles, nextCursor } = await ProfilesRepository.findMany({
      limit: query.limit,
      cursor: query.cursor,
    });

    return {
      profiles: profiles.map((p) => ({
        id: p.id,
        fullName: p.fullName,
        jobTitle: p.jobTitle,
        company: p.company,
        imageKey: p.imageKey,
        thumbnailUrl: p.imageKey
          ? p.imageKey.startsWith("uploads/dynamic/")
            ? toProxyUrl(p.imageKey)
            : toProxyUrl(toThumbnailKey(p.imageKey))
          : null,
        createdAt: p.createdAt.toISOString(),
      } satisfies ProfileListItemDto)),
      nextCursor,
    };
  },

  // ── Get single profile ──────────────────────────────────────────
  async getById(id: string): Promise<ProfileDetailDto | null> {
    const profile = await ProfilesRepository.findById(id);
    if (!profile) return null;

    return {
      id: profile.id,
      fullName: profile.fullName,
      jobTitle: profile.jobTitle,
      company: profile.company,
      imageKey: profile.imageKey,
      originalUrl: profile.imageKey ? toProxyUrl(profile.imageKey) : null,
      thumbnailUrl: profile.imageKey
        ? profile.imageKey.startsWith("uploads/dynamic/")
          ? toProxyUrl(profile.imageKey)
          : toProxyUrl(toThumbnailKey(profile.imageKey))
        : null,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  },

  // ── Create profile ──────────────────────────────────────────────
  async create(data: CreateProfileDto) {
    // Post-upload size and type verification in S3
    if (data.imageKey) {
      const meta = await S3Service.getObjectMetadata(data.imageKey);
      if (!meta) {
        throw new Error("Uploaded image not found in storage.");
      }
      if (meta.size > MAX_IMAGE_SIZE) {
        await S3Service.deleteObject(data.imageKey);
        throw new Error("Uploaded image exceeds the maximum size limit of 5MB.");
      }
      const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedMimes.includes(meta.contentType)) {
        await S3Service.deleteObject(data.imageKey);
        throw new Error("Invalid image file type.");
      }
    }

    const profile = await ProfilesRepository.create(data);

    // Remove the cleanup tag so S3 lifecycle rule does not delete the original image
    if (data.imageKey) {
      S3Service.removeCleanupTag(data.imageKey).catch((err) => {
        console.warn(`[ProfilesService.create] Failed to remove S3 cleanup tag for key ${data.imageKey}:`, err);
      });
    }

    return profile;
  },

  // ── Update profile ──────────────────────────────────────────────
  async update(id: string, data: UpdateProfileDto) {
    const existing = await ProfilesRepository.findById(id);
    if (!existing) return null;

    // Validate the new file size and type if changing image
    if (data.imageKey !== undefined && data.imageKey !== existing.imageKey && data.imageKey) {
      const meta = await S3Service.getObjectMetadata(data.imageKey);
      if (!meta) {
        throw new Error("Uploaded image not found in storage.");
      }
      if (meta.size > MAX_IMAGE_SIZE) {
        await S3Service.deleteObject(data.imageKey);
        throw new Error("Uploaded image exceeds the maximum size limit of 5MB.");
      }
      const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedMimes.includes(meta.contentType)) {
        await S3Service.deleteObject(data.imageKey);
        throw new Error("Invalid image file type.");
      }
    }

    const profile = await ProfilesRepository.update(id, data);
    if (!profile) return null;

    // If image was changed, clean up the old S3 assets
    if (data.imageKey !== undefined && data.imageKey !== existing.imageKey) {
      // 1. Remove cleanup tag on new key so S3 lifecycle rule doesn't delete it
      if (data.imageKey) {
        S3Service.removeCleanupTag(data.imageKey).catch((err) => {
          console.warn(`[ProfilesService.update] Failed to remove S3 cleanup tag for key ${data.imageKey}:`, err);
        });
      }

      // 2. Delete the old original image and old thumbnail from S3
      if (existing.imageKey) {
        const oldKey = existing.imageKey;
        const oldThumbKey = toThumbnailKey(oldKey);

        S3Service.deleteObject(oldKey).catch((err) => {
          console.warn(`[ProfilesService.update] Failed to delete old S3 object ${oldKey}:`, err);
        });
        S3Service.deleteObject(oldThumbKey).catch((err) => {
          console.warn(`[ProfilesService.update] Failed to delete old S3 thumbnail ${oldThumbKey}:`, err);
        });
      }
    }

    return profile;
  },

  // ── Delete profile ──────────────────────────────────────────────
  async delete(id: string): Promise<boolean> {
    const existing = await ProfilesRepository.findById(id);
    if (!existing) return false;

    const ok = await ProfilesRepository.delete(id);
    if (ok && existing.imageKey) {
      // Delete the original image and thumbnail from S3
      const oldKey = existing.imageKey;
      const oldThumbKey = toThumbnailKey(oldKey);

      S3Service.deleteObject(oldKey).catch((err) => {
        console.warn(`[ProfilesService.delete] Failed to delete S3 object ${oldKey}:`, err);
      });
      S3Service.deleteObject(oldThumbKey).catch((err) => {
        console.warn(`[ProfilesService.delete] Failed to delete S3 thumbnail ${oldThumbKey}:`, err);
      });
    }
    return ok;
  },

  // ── Presign S3 upload URL ───────────────────────────────────────
  async presignUpload(data: PresignUploadDto) {
    const prefix = data.strategy === "dynamic" ? "uploads/dynamic" : "uploads/raw";
    const imageKey = `${prefix}/${randomUUID()}-${sanitizeFilename(data.filename)}`;
    const uploadUrl = await S3Service.createPutUrl({
      key: imageKey,
      contentType: data.contentType,
      contentLength: data.size,
      contentMd5: data.contentMd5,
    });
    return { uploadUrl, imageKey };
  },

  // ── Initiate Multipart Upload ───────────────────────────────────
  async initiateMultipart(data: InitiateMultipartDto) {
    const prefix = data.strategy === "dynamic" ? "uploads/dynamic" : "uploads/raw";
    const imageKey = `${prefix}/${randomUUID()}-${sanitizeFilename(data.filename)}`;
    const uploadId = await S3Service.initiateMultipartUpload(imageKey, data.contentType);

    // Chunk size: 5MB minimum
    const chunkSize = 5 * 1024 * 1024;
    const numParts = Math.ceil(data.size / chunkSize);

    const partPromises = Array.from({ length: numParts }, (_, i) => {
      const partNumber = i + 1;
      const partSize = partNumber === numParts
        ? data.size - i * chunkSize
        : chunkSize;
      return S3Service.createUploadPartUrl({
        key: imageKey,
        uploadId,
        partNumber,
        contentLength: partSize,
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
    await S3Service.completeMultipartUpload({
      key: data.key,
      uploadId: data.uploadId,
      parts: data.parts,
    });
  },

  async deleteTempFile(key: string) {
    await S3Service.deleteObject(key);
  },
};
