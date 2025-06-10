import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class BlobHandlerService {
  private readonly logger = new Logger(BlobHandlerService.name);
  private readonly uploadDir = 'uploads/chat';

  constructor() {
    // Ensure upload directory exists
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }
  /**
   * Check if a URL is a blob URL
   */
  isBlobUrl(url: string): boolean {
    return Boolean(url && url.startsWith('blob:'));
  }

  /**
   * Process attachments array, converting blob URLs to file URLs
   * Returns array of processed URLs and file metadata
   */
  async processAttachments(attachments: string[]): Promise<{
    processedUrls: string[];
    fileMetadata: Array<{
      url: string;
      fileName: string;
      fileSize?: number;
      mimeType?: string;
    }>;
  }> {
    if (!attachments || !Array.isArray(attachments)) {
      return { processedUrls: [], fileMetadata: [] };
    }

    const processedUrls: string[] = [];
    const fileMetadata: Array<{
      url: string;
      fileName: string;
      fileSize?: number;
      mimeType?: string;
    }> = [];

    for (const attachment of attachments) {
      if (this.isBlobUrl(attachment)) {
        this.logger.log(`🔄 Processing blob URL: ${attachment}`);

        try {
          // For now, we'll create a placeholder for blob URLs
          // In a real implementation, you would need to:
          // 1. Fetch the blob data from the frontend
          // 2. Save it to your file system
          // 3. Return the new file URL

          // Since blob URLs are client-side only and can't be accessed from server,
          // we need a different approach. The frontend should send the actual file data.

          // For now, we'll log this and keep the original URL
          this.logger.warn(
            `⚠️ Blob URL detected but cannot be processed server-side: ${attachment}`,
          );
          this.logger.warn(
            `💡 Frontend should send actual file data instead of blob URLs`,
          );

          // Keep the original blob URL for now
          processedUrls.push(attachment);
          fileMetadata.push({
            url: attachment,
            fileName: `blob-file-${uuidv4()}`,
            mimeType: 'application/octet-stream',
          });
        } catch (error) {
          this.logger.error(
            `❌ Error processing blob URL ${attachment}:`,
            error,
          );
          // Continue with other attachments
        }
      } else {
        // Regular URL, keep as is
        processedUrls.push(attachment);
        fileMetadata.push({
          url: attachment,
          fileName: path.basename(attachment),
        });
      }
    }

    this.logger.log(`✅ Processed ${attachments.length} attachments:`, {
      original: attachments,
      processed: processedUrls,
      metadata: fileMetadata,
    });

    return { processedUrls, fileMetadata };
  }

  /**
   * Alternative approach: Process base64 data URLs or file objects
   */
  async processFileData(fileData: {
    content: string; // base64 or file content
    fileName: string;
    mimeType?: string;
    size?: number;
  }): Promise<{
    fileUrl: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }> {
    try {
      const fileExtension =
        path.extname(fileData.fileName) ||
        this.getExtensionFromMimeType(fileData.mimeType);
      const newFileName = `${uuidv4()}${fileExtension}`;
      const filePath = path.join(this.uploadDir, newFileName);

      // Handle base64 data
      if (fileData.content.startsWith('data:')) {
        const base64Data = fileData.content.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(filePath, buffer);

        return {
          fileUrl: `/uploads/chat/${newFileName}`,
          fileName: fileData.fileName,
          fileSize: buffer.length,
          mimeType: fileData.mimeType || 'application/octet-stream',
        };
      }

      throw new BadRequestException('Unsupported file data format');
    } catch (error) {
      this.logger.error('Error processing file data:', error);
      throw new BadRequestException('Failed to process file data');
    }
  }

  private getExtensionFromMimeType(mimeType?: string): string {
    if (!mimeType) return '';

    const mimeToExt: { [key: string]: string } = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
      'text/plain': '.txt',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        '.docx',
    };

    return mimeToExt[mimeType] || '';
  }
}
