import { IsString, IsEnum, IsOptional, IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InitiateCallDto {
  @ApiProperty({ description: 'Doctor user ID' })
  @IsMongoId()
  doctorId: string;

  @ApiProperty({
    description: 'Type of call',
    enum: ['video', 'voice'],
    default: 'video',
  })
  @IsEnum(['video', 'voice'])
  callType: 'video' | 'voice';

  @ApiProperty({ description: 'Appointment ID (optional)', required: false })
  @IsOptional()
  @IsMongoId()
  appointmentId?: string;
}

export class AddCallNotesDto {
  @ApiProperty({ description: 'Doctor notes after call' })
  @IsString()
  notes: string;
}
