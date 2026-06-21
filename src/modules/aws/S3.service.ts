import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  DeleteObjectTaggingCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getEnv } from "@/lib/env";

let _client: S3Client | undefined;

function getClient(): S3Client {
  if (!_client) {
    const env = getEnv();
    _client = new S3Client({
      region: env.AWS_REGION,
      requestChecksumCalculation: "WHEN_REQUIRED",
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return _client;
}

export const S3Service = {
  async createPutUrl(input: { key: string; contentType: string; contentMd5?: string }): Promise<string> {
    return getSignedUrl(
      getClient(),
      new PutObjectCommand({
        Bucket: getEnv().S3_BUCKET_NAME,
        Key: input.key,
        ContentType: input.contentType,
        Tagging: "cleanup=true",
        ContentMD5: input.contentMd5,
      }),
      {
        expiresIn: 60 * 5,
        signableHeaders: new Set(["content-type", "content-md5"]),
      }
    );
  },

  async createGetUrl(key: string): Promise<string> {
    return getSignedUrl(
      getClient(),
      new GetObjectCommand({ Bucket: getEnv().S3_BUCKET_NAME, Key: key }),
      { expiresIn: 60 * 10 }
    );
  },

  async keyExists(key: string): Promise<boolean> {
    try {
      await getClient().send(
        new HeadObjectCommand({ Bucket: getEnv().S3_BUCKET_NAME, Key: key })
      );
      return true;
    } catch (err: unknown) {
      const name = (err as { name?: string }).name ?? "";
      const code = (err as { Code?: string }).Code ?? "";
      const status = (err as { $metadata?: { httpStatusCode?: number } })
        ?.$metadata?.httpStatusCode;
      if (["NotFound", "NoSuchKey"].includes(name) ||
        ["NotFound", "NoSuchKey"].includes(code) ||
        status === 404) return false;
      throw err;
    }
  },

  async removeCleanupTag(key: string): Promise<void> {
    await getClient().send(
      new DeleteObjectTaggingCommand({
        Bucket: getEnv().S3_BUCKET_NAME,
        Key: key,
      })
    );
  },

  async deleteObject(key: string): Promise<void> {
    await getClient().send(
      new DeleteObjectCommand({
        Bucket: getEnv().S3_BUCKET_NAME,
        Key: key,
      })
    );
  },

  async initiateMultipartUpload(key: string, contentType: string): Promise<string> {
    const res = await getClient().send(
      new CreateMultipartUploadCommand({
        Bucket: getEnv().S3_BUCKET_NAME,
        Key: key,
        ContentType: contentType,
        Tagging: "cleanup=true",
      })
    );
    if (!res.UploadId) throw new Error("Failed to initiate S3 multipart upload.");
    return res.UploadId;
  },

  async createUploadPartUrl(input: {
    key: string;
    uploadId: string;
    partNumber: number;
  }): Promise<string> {
    return getSignedUrl(
      getClient(),
      new UploadPartCommand({
        Bucket: getEnv().S3_BUCKET_NAME,
        Key: input.key,
        UploadId: input.uploadId,
        PartNumber: input.partNumber,
      }),
      { expiresIn: 60 * 20 }
    );
  },

  async completeMultipartUpload(input: {
    key: string;
    uploadId: string;
    parts: { PartNumber: number; ETag: string }[];
  }): Promise<void> {
    await getClient().send(
      new CompleteMultipartUploadCommand({
        Bucket: getEnv().S3_BUCKET_NAME,
        Key: input.key,
        UploadId: input.uploadId,
        MultipartUpload: { Parts: input.parts },
      })
    );
  },

  async abortMultipartUpload(input: { key: string; uploadId: string }): Promise<void> {
    await getClient().send(
      new AbortMultipartUploadCommand({
        Bucket: getEnv().S3_BUCKET_NAME,
        Key: input.key,
        UploadId: input.uploadId,
      })
    );
  },

  async streamFromS3(key: string, ifNoneMatch?: string | null) {
    const env = getEnv();
    try {
      const res = await getClient().send(
        new GetObjectCommand({ Bucket: env.S3_BUCKET_NAME, Key: key })
      );
      if (!res.Body) return { kind: "not_found" as const };

      // Conditional GET — skip transfer if client already has this version
      if (res.ETag && ifNoneMatch && ifNoneMatch === res.ETag) {
        return { kind: "not_modified" as const, etag: res.ETag };
      }

      const chunks: Uint8Array[] = [];
      for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      return {
        kind: "ok" as const,
        buffer: Buffer.concat(chunks),
        contentType: res.ContentType ?? inferContentType(key),
        etag: res.ETag,
      };
    } catch (err: unknown) {
      const name = (err as { name?: string }).name ?? "";
      const code = (err as { Code?: string }).Code ?? "";
      const status = (err as { $metadata?: { httpStatusCode?: number } })
        ?.$metadata?.httpStatusCode;
      if (["NotFound", "NoSuchKey"].includes(name) ||
        ["NotFound", "NoSuchKey"].includes(code) ||
        status === 404) return { kind: "not_found" as const };
      throw err;
    }
  },
};

function inferContentType(key: string): string {
  if (key.endsWith(".webp")) return "image/webp";
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}
