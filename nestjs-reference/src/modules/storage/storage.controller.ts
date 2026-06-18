import { Controller, Post, Body, HttpCode, HttpStatus, Get, Param, Res, Header } from '@nestjs/common';
import { Response } from 'express';
import { Readable } from 'stream';
import { StorageService } from './storage.service';
import { PresignDto, InitMultipartDto, CompleteMultipartDto, DeleteObjectDto } from './dto/storage.dto';
import { v4 as uuidv4 } from 'uuid';

@Controller('s3')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('presign')
  @HttpCode(HttpStatus.OK)
  async getPresignedUrl(@Body() dto: PresignDto) {
    const sanitizedName = dto.filename.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '');
    const imageKey = `uploads/raw/${uuidv4()}-${sanitizedName}`;
    const uploadUrl = await this.storageService.createPutUrl(imageKey, dto.contentType, dto.contentMd5);
    return { uploadUrl, imageKey };
  }

  @Post('multipart/init')
  @HttpCode(HttpStatus.OK)
  async initMultipart(@Body() dto: InitMultipartDto) {
    const sanitizedName = dto.filename.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '');
    const imageKey = `uploads/raw/${uuidv4()}-${sanitizedName}`;
    const uploadId = await this.storageService.initiateMultipartUpload(imageKey, dto.contentType);

    const chunkSize = 5 * 1024 * 1024; // 5MB
    const totalParts = Math.ceil(dto.size / chunkSize);

    const partPromises = Array.from({ length: totalParts }, async (_, i) => {
      const partNumber = i + 1;
      const uploadUrl = await this.storageService.createUploadPartUrl(imageKey, uploadId, partNumber);
      return { partNumber, uploadUrl };
    });

    const parts = await Promise.all(partPromises);
    return { uploadId, key: imageKey, parts };
  }

  @Post('multipart/complete')
  @HttpCode(HttpStatus.OK)
  async completeMultipart(@Body() dto: CompleteMultipartDto) {
    await this.storageService.completeMultipartUpload(dto.key, dto.uploadId, dto.parts);
    return { success: true };
  }

  @Post('delete')
  @HttpCode(HttpStatus.OK)
  async deleteObject(@Body() dto: DeleteObjectDto) {
    await this.storageService.deleteObject(dto.key);
    return { success: true };
  }

  /**
   * 🖼️ Server-Side Image Proxy
   * Matches any S3 key path under 'images/' (e.g. GET /s3/images/uploads/thumbnails/pic.jpg.webp)
   */
  @Get('images/*')
  async proxyImage(@Param('0') keyPath: string, @Res() res: Response) {
    if (!keyPath) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Missing S3 key path.' });
    }

    try {
      const s3Response = await this.storageService.getS3ReadableStream(keyPath);

      // Set content type & CDN/Browser caching headers
      res.setHeader('Content-Type', s3Response.ContentType || 'image/jpeg');
      
      const isThumbnail = keyPath.startsWith('uploads/thumbnails/');
      const cacheControl = isThumbnail
        ? 'public, max-age=31536000, s-maxage=31536000, immutable'
        : 'public, max-age=600, s-maxage=600, must-revalidate';
      
      res.setHeader('Cache-Control', cacheControl);
      res.setHeader('Vary', '');
      if (s3Response.ETag) {
        res.setHeader('ETag', s3Response.ETag);
      }

      // Stream binary data directly from S3 to client response
      const stream = s3Response.Body as Readable;
      stream.pipe(res);
    } catch (err: any) {
      if (err.status === HttpStatus.NOT_FOUND) {
        return res.status(HttpStatus.NOT_FOUND).json({ error: 'Image not found.' });
      }
      return res.status(HttpStatus.BAD_GATEWAY).json({ error: 'Error streaming image.' });
    }
  }
}
