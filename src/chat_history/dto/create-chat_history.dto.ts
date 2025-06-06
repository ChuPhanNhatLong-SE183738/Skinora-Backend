import { IsNotEmpty, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateChatHistoryDto {
  @ApiProperty({ description: 'User ID' })
  @IsNotEmpty()
  @IsNumber()
  userId: number;
}
