import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailDto {
  @ApiProperty({
    description: 'Email verification token',
    example: '1234567890abcdef1234567890abcdef',
  })
  @IsString()
  @IsNotEmpty()
  token: string;
}
