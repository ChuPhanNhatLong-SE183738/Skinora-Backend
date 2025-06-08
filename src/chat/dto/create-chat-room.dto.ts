import { IsMongoId, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateChatRoomDto {
  @ApiProperty({
    description: 'Patient ID',
    example: '675abc123def456789012345',
  })
  @IsMongoId()
  patientId: string;

  @ApiProperty({
    description: 'Doctor ID',
    example: '675def456abc789012345678',
  })
  @IsMongoId()
  doctorId: string;

  @ApiProperty({
    description: 'Related appointment ID (optional)',
    example: '675ghi789def012345678901',
    required: false,
  })
  @IsOptional()
  @IsMongoId()
  appointmentId?: string;
}
