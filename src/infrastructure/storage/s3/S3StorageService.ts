import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { UploadUrlSigner } from "@/core/use-cases/GetPresignedUrlUseCase";
import { getServerEnv } from "@/shared/env";

export class S3StorageService implements UploadUrlSigner {
  private readonly client: S3Client;
  private readonly bucketName: string;

  constructor() {
    const env = getServerEnv();
    this.bucketName = env.S3_BUCKET_NAME;
    this.client = new S3Client({
      region: env.AWS_REGION,
      requestChecksumCalculation: "WHEN_REQUIRED",
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY
      }
    });
  }

  async createPutUrl(input: { key: string; contentType: string }) {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: input.key,
        ContentType: input.contentType
      });

      return await getSignedUrl(this.client, command, { expiresIn: 60 * 5 });
    } catch (err) {
      console.error(`[S3StorageService] createPutUrl failed — bucket: ${this.bucketName}, key: ${input.key}`, err);
      throw err;
    }
  }

  async createGetUrl(key: string) {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key
    });

    return getSignedUrl(this.client, command, { expiresIn: 60 * 10 });
  }

  /** Returns true if the object exists in S3, false if NoSuchKey / 404. */
  async keyExists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucketName, Key: key })
      );
      return true;
    } catch (err: unknown) {
      const code =
        (err as { name?: string; $metadata?: { httpStatusCode?: number } }).name ??
        (err as { Code?: string }).Code;
      if (
        code === "NotFound" ||
        code === "NoSuchKey" ||
        (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode === 404
      ) {
        return false;
      }
      throw err;
    }
  }

  /**
   * Returns a presigned GET URL for the thumbnail key if it exists,
   * otherwise falls back to a presigned GET URL for the raw original key.
   */
  async createThumbnailUrl(thumbnailKey: string, fallbackKey: string): Promise<string> {
    const exists = await this.keyExists(thumbnailKey);
    return this.createGetUrl(exists ? thumbnailKey : fallbackKey);
  }
}
