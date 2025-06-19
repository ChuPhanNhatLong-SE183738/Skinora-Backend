import {
  IsString,
  IsEnum,
  IsOptional,
  IsMongoId,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InitiateCallDto {
  @ApiProperty({ description: 'Patient ID who will receive the call' })
  @IsString()
  @IsNotEmpty()
  patientId: string;

  @ApiProperty({ description: 'Doctor ID who will make the call' })
  @IsString()
  @IsNotEmpty()
  doctorId: string;

  @ApiProperty({
    description: 'Type of call - video or voice',
    enum: ['video', 'voice'],
    default: 'video',
  })
  @IsEnum(['video', 'voice'])
  callType: 'video' | 'voice';

  @ApiProperty({
    description: 'Associated appointment ID (optional)',
    required: false,
  })
  @IsOptional()
  @IsString()
  appointmentId?: string;
}

export class AddCallNotesDto {
  @ApiProperty({ description: 'Doctor notes after call' })
  @IsString()
  notes: string;
}

export class JoinCallDto {
  @ApiProperty({
    description: 'Device type joining the call',
    enum: ['mobile', 'web'],
    default: 'mobile',
  })
  @IsOptional()
  @IsEnum(['mobile', 'web'])
  device?: 'mobile' | 'web';
}
