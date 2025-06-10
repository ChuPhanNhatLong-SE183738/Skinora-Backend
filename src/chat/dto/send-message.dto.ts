import {
  IsString,
  IsOptional,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsArray,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({ description: 'Chat room ID', required: false })
  @IsOptional()
  @IsMongoId()
  chatRoomId?: string;

  @ApiProperty({
    description: 'Room ID (alternative field name)',
    required: false,
  })
  @IsOptional()
  @IsMongoId()
  roomId?: string;

  @ApiProperty({
    description:
      'Sender user ID (will be auto-extracted from JWT token if not provided)',
    required: false,
  })
  @IsOptional()
  @IsMongoId()
  senderId?: string;

  @ApiProperty({
    description:
      'Sender type (will be auto-detected from user role if not provided)',
    enum: ['patient', 'doctor'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['patient', 'doctor'])
  senderType?: 'patient' | 'doctor';

  @ApiProperty({ description: 'Message content/text' })
  @IsString()
  content: string;

  @ApiProperty({
    description: 'Message type',
    enum: ['text', 'image', 'file'],
    required: false,
    default: 'text',
  })
  @IsOptional()
  @IsEnum(['text', 'image', 'file'])
  messageType?: 'text' | 'image' | 'file';

  @ApiProperty({ description: 'Firebase file URL', required: false })
  @IsOptional()
  @IsString()
  fileUrl?: string;

  @ApiProperty({ description: 'File name', required: false })
  @IsOptional()
  @IsString()
  fileName?: string;

  @ApiProperty({ description: 'File size in bytes', required: false })
  @IsOptional()
  @IsNumber()
  fileSize?: number;

  @ApiProperty({ description: 'MIME type of the file', required: false })
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiProperty({
    description: 'Firebase attachment URLs',
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];

  // Cloudinary specific properties
  @ApiProperty({
    description: 'Original file name from upload',
    required: false,
  })
  @IsOptional()
  @IsString()
  originalName?: string;

  @ApiProperty({ description: 'Cloudinary public ID', required: false })
  @IsOptional()
  @IsString()
  publicId?: string;

  @ApiProperty({ description: 'Cloudinary asset ID', required: false })
  @IsOptional()
  @IsString()
  assetId?: string;

  @ApiProperty({ description: 'File format (jpg, png, etc.)', required: false })
  @IsOptional()
  @IsString()
  format?: string;

  @ApiProperty({
    description: 'Resource type (image, video, etc.)',
    required: false,
  })
  @IsOptional()
  @IsString()
  resourceType?: string;

  @ApiProperty({ description: 'Cloudinary version number', required: false })
  @IsOptional()
  @IsNumber()
  version?: number;

  @ApiProperty({ description: 'Image width in pixels', required: false })
  @IsOptional()
  @IsNumber()
  width?: number;

  @ApiProperty({ description: 'Image height in pixels', required: false })
  @IsOptional()
  @IsNumber()
  height?: number;

  @ApiProperty({ description: 'Cloudinary secure URL', required: false })
  @IsOptional()
  @IsString()
  secure_url?: string;

  @ApiProperty({
    description: 'File size in bytes from Cloudinary',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  bytes?: number;
}

// Create a separate DTO for the internal service method
export class CreateMessageDto {
  roomId: string;
  senderId: string;
  senderType: 'patient' | 'doctor';
  content: string;
  messageType?: 'text' | 'image' | 'file';
  fileUrl?: string;
  fileName?: string;
  attachments?: string[];
}
