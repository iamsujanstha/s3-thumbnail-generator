import { z } from "zod";

const imageMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;

export const createProfileSchema = z.object({
  fullName:  z.string().trim().min(2).max(120),
  jobTitle:  z.string().trim().min(2).max(120),
  company:   z.string().trim().min(2).max(120),
  imageKey:  z.string().startsWith("uploads/raw/").max(512),
});

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  jobTitle: z.string().trim().min(2).max(120),
  company:  z.string().trim().min(2).max(120),
});

export const presignUploadSchema = z.object({
  filename:    z.string().trim().min(1).max(180),
  contentType: z.enum(imageMimeTypes),
  size:        z.number().int().positive().max(200 * 1024 * 1024),
});

export const listQuerySchema = z.object({
  limit:  z.coerce.number().int().min(1).max(50).default(12),
  cursor: z.string().optional(),
});

export type CreateProfileDto = z.infer<typeof createProfileSchema>;
export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
export type PresignUploadDto = z.infer<typeof presignUploadSchema>;
export type ListQueryDto     = z.infer<typeof listQuerySchema>;

export const initiateMultipartSchema = z.object({
  filename:    z.string().trim().min(1).max(180),
  contentType: z.enum(imageMimeTypes),
  size:        z.number().int().positive(),
});

export const completeMultipartSchema = z.object({
  uploadId: z.string().min(1),
  key:      z.string().startsWith("uploads/raw/").max(512),
  parts:    z.array(
    z.object({
      PartNumber: z.number().int().positive(),
      ETag:       z.string().min(1),
    })
  ),
});

export type InitiateMultipartDto = z.infer<typeof initiateMultipartSchema>;
export type CompleteMultipartDto = z.infer<typeof completeMultipartSchema>;
