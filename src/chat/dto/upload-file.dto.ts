import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UploadFileDto {
  @ApiProperty({ description: 'Optional message content', required: false })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty({
    description: 'Message type',
    enum: ['text', 'image', 'file'],
    required: false,
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
    description: 'Array of Firebase attachment URLs',
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}
