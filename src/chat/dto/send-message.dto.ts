import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({
    description: 'Message content',
    example: 'Hello doctor, I need help with my skin condition',
    required: false,
  })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty({
    description: 'Message type',
    enum: ['text', 'image', 'file'],
    default: 'text',
    example: 'text',
    required: false,
  })
  @IsOptional()
  @IsEnum(['text', 'image', 'file'])
  messageType?: string;

  @ApiProperty({
    description: 'File attachments URLs',
    required: false,
    example: ['https://example.com/image1.jpg'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}
