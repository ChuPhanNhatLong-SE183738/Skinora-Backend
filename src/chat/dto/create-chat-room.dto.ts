import { IsString, IsNotEmpty, IsOptional, IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateChatRoomDto {
  @ApiProperty({ description: 'Patient user ID' })
  @IsMongoId()
  @IsNotEmpty()
  patientId: string;

  @ApiProperty({ description: 'Doctor user ID' })
  @IsMongoId()
  @IsNotEmpty()
  doctorId: string;

  @ApiProperty({ description: 'Related appointment ID', required: false })
  @IsOptional()
  @IsMongoId()
  appointmentId?: string;
}
