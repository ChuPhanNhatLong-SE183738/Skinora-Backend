import { IsNotEmpty, IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum SenderType {
  AI = 'ai',
  USER = 'user',
}

export class CreateChatMessageDto {
  @ApiProperty({ description: 'Chat History ID', type: String })
  @IsNotEmpty()
  @IsString()
  chatId: string;

  @ApiProperty({ description: 'User ID', type: String })
  @IsNotEmpty()
  @IsString()
  userId: string;

  @ApiProperty({ description: 'Message sender', enum: SenderType })
  @IsNotEmpty()
  @IsEnum(SenderType)
  sender: SenderType;

  @ApiProperty({ description: 'Message content' })
  @IsNotEmpty()
  @IsString()
  messageContent: string;
}
