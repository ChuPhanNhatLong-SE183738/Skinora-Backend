import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UploadFileDto {
  @ApiProperty({ description: 'Optional message content', required: false })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty({
    description: 'Message type',
    enum: ['image', 'file'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['image', 'file'])
  messageType?: 'image' | 'file';
}
