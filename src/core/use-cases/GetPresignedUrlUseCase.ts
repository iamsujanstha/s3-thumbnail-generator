import { randomUUID } from "crypto";
import type { PresignUploadDto } from "@/shared/dtos";
import { sanitizeFilename } from "@/shared/utils";

export type UploadPresignResult = {
  uploadUrl: string;
  imageKey: string;
};

export interface UploadUrlSigner {
  createPutUrl(input: { key: string; contentType: string }): Promise<string>;
}

export class GetPresignedUrlUseCase {
  constructor(private readonly uploadUrlSigner: UploadUrlSigner) {}

  async execute(input: PresignUploadDto): Promise<UploadPresignResult> {
    const safeFilename = sanitizeFilename(input.filename);
    const imageKey = `uploads/raw/${randomUUID()}-${safeFilename}`;
    const uploadUrl = await this.uploadUrlSigner.createPutUrl({
      key: imageKey,
      contentType: input.contentType
    });

    return { uploadUrl, imageKey };
  }
}
