import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class DoctorLoginDto {
  @ApiProperty({
    description: 'Doctor email address',
    example: 'doctor@skinora.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Doctor password',
    example: 'password123',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password: string;
}
