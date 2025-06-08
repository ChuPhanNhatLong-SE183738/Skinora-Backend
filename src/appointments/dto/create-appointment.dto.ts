import { IsDate, IsMongoId, IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAppointmentDto {
  @ApiProperty({ description: 'User ID', example: '60d21b4667d0d8992e610c85' })
  @IsNotEmpty()
  @IsMongoId()
  userId: string;

  @ApiProperty({ description: 'Doctor ID', example: '60d21b4667d0d8992e610c86' })
  @IsNotEmpty()
  @IsMongoId()
  doctorId: string;

  @ApiProperty({ description: 'Selected date (YYYY-MM-DD)', example: '2023-12-15' })
  @IsNotEmpty()
  @IsString()
  date: string;

  @ApiProperty({ description: 'Selected time slot (HH:MM)', example: '14:30' })
  @IsNotEmpty()
  @IsString()
  timeSlot: string;
}
