// Re-exports for backward compatibility.
// New code should import directly from @/types/dtos
export type { ProfileListItemDto, ProfileDetailDto } from "@/types/dtos";

// Zod schemas (server-only — kept here for existing client-side DTO types)
import { z } from "zod";

export const createProfileSchema = z.object({
  fullName:  z.string().trim().min(2).max(120),
  jobTitle:  z.string().trim().min(2).max(120),
  company:   z.string().trim().min(2).max(120),
  imageKey:  z.union([
    z.string().startsWith("uploads/raw/").max(512),
    z.string().startsWith("uploads/dynamic/").max(512),
  ]),
});

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  jobTitle: z.string().trim().min(2).max(120),
  company:  z.string().trim().min(2).max(120),
});

export const presignUploadSchema = z.object({
  filename:    z.string().trim().min(1).max(180),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"] as const),
  size:        z.number().int().positive().max(5 * 1024 * 1024),
  strategy:    z.enum(["trigger", "dynamic"]).optional().default("trigger"),
});

export type CreateProfileDto  = z.infer<typeof createProfileSchema>;
export type UpdateProfileDto  = z.infer<typeof updateProfileSchema>;
export type PresignUploadDto  = z.infer<typeof presignUploadSchema>;
