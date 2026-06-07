import { z } from "zod";

const imageMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;

export const createProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  jobTitle: z.string().trim().min(2).max(120),
  company: z.string().trim().min(2).max(120),
  imageKey: z.string().startsWith("uploads/raw/").max(512)
});

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  jobTitle: z.string().trim().min(2).max(120),
  company: z.string().trim().min(2).max(120)
});

export const presignUploadSchema = z.object({
  filename: z.string().trim().min(1).max(180),
  contentType: z.enum(imageMimeTypes),
  size: z.number().int().positive().max(5 * 1024 * 1024)
});

export type CreateProfileDto = z.infer<typeof createProfileSchema>;
export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
export type PresignUploadDto = z.infer<typeof presignUploadSchema>;

export type ProfileListItemDto = {
  id: string;
  fullName: string;
  jobTitle: string;
  company: string;
  imageKey: string;
  thumbnailUrl: string;
  createdAt: string;
};

export type ProfileDetailDto = {
  id: string;
  fullName: string;
  jobTitle: string;
  company: string;
  imageKey: string;
  thumbnailUrl: string;
  originalUrl: string;
  createdAt: string;
  updatedAt: string;
};
