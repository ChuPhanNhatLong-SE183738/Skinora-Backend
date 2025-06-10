import { Test, TestingModule } from '@nestjs/testing';
import { BlobHandlerService } from './blob-handler.service';

describe('BlobHandlerService', () => {
  let service: BlobHandlerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BlobHandlerService],
    }).compile();

    service = module.get<BlobHandlerService>(BlobHandlerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isBlobUrl', () => {
    it('should detect blob URLs correctly', () => {
      expect(
        service.isBlobUrl(
          'blob:http://localhost:5173/7c6dca06-c744-4652-9028-0d64bc55e829',
        ),
      ).toBe(true);
      expect(service.isBlobUrl('blob:https://example.com/some-blob-id')).toBe(
        true,
      );
    });

    it('should reject non-blob URLs', () => {
      expect(service.isBlobUrl('http://example.com/file.pdf')).toBe(false);
      expect(service.isBlobUrl('https://example.com/image.jpg')).toBe(false);
      expect(service.isBlobUrl('/uploads/file.pdf')).toBe(false);
      expect(service.isBlobUrl('')).toBe(false);
    });
  });

  describe('processAttachments', () => {
    it('should process mixed URLs correctly', async () => {
      const attachments = [
        'blob:http://localhost:5173/7c6dca06-c744-4652-9028-0d64bc55e829',
        'https://example.com/real-file.pdf',
        '/uploads/local-file.jpg',
      ];

      const result = await service.processAttachments(attachments);

      expect(result.processedUrls).toHaveLength(3);
      expect(result.fileMetadata).toHaveLength(3);

      // Blob URL should be kept as-is (since we can't process it server-side)
      expect(result.processedUrls[0]).toContain('blob:');
      expect(result.fileMetadata[0].fileName).toContain('blob-file-');

      // Regular URLs should be kept as-is
      expect(result.processedUrls[1]).toBe('https://example.com/real-file.pdf');
      expect(result.processedUrls[2]).toBe('/uploads/local-file.jpg');
    });

    it('should handle empty attachments array', async () => {
      const result = await service.processAttachments([]);
      expect(result.processedUrls).toEqual([]);
      expect(result.fileMetadata).toEqual([]);
    });

    it('should handle null/undefined attachments', async () => {
      const result1 = await service.processAttachments(null as any);
      const result2 = await service.processAttachments(undefined as any);

      expect(result1.processedUrls).toEqual([]);
      expect(result1.fileMetadata).toEqual([]);
      expect(result2.processedUrls).toEqual([]);
      expect(result2.fileMetadata).toEqual([]);
    });
  });
});
