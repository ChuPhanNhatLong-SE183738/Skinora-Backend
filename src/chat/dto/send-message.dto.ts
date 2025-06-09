import {
  IsString,
  IsOptional,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({ description: 'Chat room ID', required: false })
  @IsOptional()
  @IsMongoId({ message: 'roomId must be a valid MongoDB ObjectId' })
  roomId?: string;

  @ApiProperty({ description: 'Sender user ID', required: false })
  @IsOptional()
  @IsMongoId({ message: 'senderId must be a valid MongoDB ObjectId' })
  senderId?: string;

  @ApiProperty({
    description: 'Sender type',
    enum: ['patient', 'doctor'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['patient', 'doctor'], {
    message: 'senderType must be either patient or doctor',
  })
  senderType?: 'patient' | 'doctor';

  @ApiProperty({ description: 'Message content' })
  @IsString({ message: 'content must be a string' })
  @IsNotEmpty({ message: 'content cannot be empty' })
  content: string;

  @ApiProperty({
    description: 'Message type',
    enum: ['text', 'image', 'file'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['text', 'image', 'file'])
  messageType?: 'text' | 'image' | 'file';

  @ApiProperty({
    description: 'File URL if message type is image or file',
    required: false,
  })
  @IsOptional()
  @IsString()
  fileUrl?: string;

  @ApiProperty({
    description: 'File name if message type is file',
    required: false,
  })
  @IsOptional()
  @IsString()
  fileName?: string;

  @ApiProperty({
    description: 'File attachments array',
    required: false,
  })
  @IsOptional()
  attachments?: string[];
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
