import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectTaggingCommand,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(private readonly configService: ConfigService) {
    this.s3Client = new S3Client({
      region: this.configService.get<string>('AWS_REGION'),
      requestChecksumCalculation: 'WHEN_REQUIRED',
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID')!,
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY')!,
      },
    });
    this.bucketName = this.configService.get<string>('S3_BUCKET_NAME')!;
  }

  async createPutUrl(key: string, contentType: string, contentMd5?: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
      Tagging: 'cleanup=true',
      ContentMD5: contentMd5,
    });

    try {
      return await getSignedUrl(this.s3Client, command, {
        expiresIn: 300,
        signableHeaders: new Set(['content-type', 'content-md5']),
      });
    } catch (err: any) {
      throw new InternalServerErrorException('Failed to generate presigned upload URL: ' + err.message);
    }
  }

  async createGetUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });
    try {
      return await getSignedUrl(this.s3Client, command, { expiresIn: 600 });
    } catch (err: any) {
      throw new InternalServerErrorException('Failed to generate GET URL: ' + err.message);
    }
  }

  async keyExists(key: string): Promise<boolean> {
    try {
      await this.s3Client.send(
        new HeadObjectCommand({ Bucket: this.bucketName, Key: key })
      );
      return true;
    } catch (err: any) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw new InternalServerErrorException('Error checking key existence: ' + err.message);
    }
  }

  async removeCleanupTag(key: string): Promise<void> {
    try {
      await this.s3Client.send(
        new DeleteObjectTaggingCommand({
          Bucket: this.bucketName,
          Key: key,
        })
      );
    } catch (err: any) {
      throw new InternalServerErrorException('Failed to remove cleanup tag: ' + err.message);
    }
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        })
      );
    } catch (err: any) {
      throw new InternalServerErrorException('Failed to delete object from S3: ' + err.message);
    }
  }

  async initiateMultipartUpload(key: string, contentType: string): Promise<string> {
    try {
      const res = await this.s3Client.send(
        new CreateMultipartUploadCommand({
          Bucket: this.bucketName,
          Key: key,
          ContentType: contentType,
          Tagging: 'cleanup=true',
        })
      );
      if (!res.UploadId) throw new Error('UploadId missing from AWS response.');
      return res.UploadId;
    } catch (err: any) {
      throw new InternalServerErrorException('Failed to initiate multipart upload: ' + err.message);
    }
  }

  async createUploadPartUrl(key: string, uploadId: string, partNumber: number): Promise<string> {
    try {
      const command = new UploadPartCommand({
        Bucket: this.bucketName,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
      });
      return await getSignedUrl(this.s3Client, command, { expiresIn: 1200 });
    } catch (err: any) {
      throw new InternalServerErrorException('Failed to create part upload URL: ' + err.message);
    }
  }

  async completeMultipartUpload(key: string, uploadId: string, parts: { PartNumber: number; ETag: string }[]): Promise<void> {
    try {
      await this.s3Client.send(
        new CompleteMultipartUploadCommand({
          Bucket: this.bucketName,
          Key: key,
          UploadId: uploadId,
          MultipartUpload: { Parts: parts },
        })
      );
    } catch (err: any) {
      throw new InternalServerErrorException('Failed to complete multipart upload: ' + err.message);
    }
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    try {
      await this.s3Client.send(
        new AbortMultipartUploadCommand({
          Bucket: this.bucketName,
          Key: key,
          UploadId: uploadId,
        })
      );
    } catch (err: any) {
      throw new InternalServerErrorException('Failed to abort multipart upload: ' + err.message);
    }
  }

  async getS3ReadableStream(key: string) {
    try {
      const res = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        })
      );
      return res;
    } catch (err: any) {
      if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
        throw new NotFoundException(`File not found: ${key}`);
      }
      throw new InternalServerErrorException('Failed to stream file from S3: ' + err.message);
    }
  }
}
