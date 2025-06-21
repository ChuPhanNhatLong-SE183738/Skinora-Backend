import { IsEmail, IsString, IsNotEmpty, MinLength, IsOptional, IsDate, IsBoolean, IsArray, ValidateNested, IsObject, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { TimeRange, WeeklyAvailability } from '../utils/availability.util';

class TimeRangeDto implements TimeRange {
  @IsString()
  @IsNotEmpty()
  start: string;

  @IsString()
  @IsNotEmpty()
  end: string;
}

class DayAvailabilityDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  isAvailable: boolean;

  @ApiProperty({ type: [TimeRangeDto] })
  @ValidateNested({ each: true })
  @Type(() => TimeRangeDto)
  timeRanges: TimeRangeDto[];

  @IsArray()
  @IsString({ each: true })
  timeSlots: string[];
}

class WeeklyAvailabilityDto implements WeeklyAvailability {
  @ApiProperty({ type: DayAvailabilityDto })
  @ValidateNested()
  @Type(() => DayAvailabilityDto)
  monday: DayAvailabilityDto;

  @ApiProperty({ type: DayAvailabilityDto })
  @ValidateNested()
  @Type(() => DayAvailabilityDto)
  tuesday: DayAvailabilityDto;

  @ApiProperty({ type: DayAvailabilityDto })
  @ValidateNested()
  @Type(() => DayAvailabilityDto)
  wednesday: DayAvailabilityDto;

  @ApiProperty({ type: DayAvailabilityDto })
  @ValidateNested()
  @Type(() => DayAvailabilityDto)
  thursday: DayAvailabilityDto;

  @ApiProperty({ type: DayAvailabilityDto })
  @ValidateNested()
  @Type(() => DayAvailabilityDto)
  friday: DayAvailabilityDto;

  @ApiProperty({ type: DayAvailabilityDto })
  @ValidateNested()
  @Type(() => DayAvailabilityDto)
  saturday: DayAvailabilityDto;

  @ApiProperty({ type: DayAvailabilityDto })
  @ValidateNested()
  @Type(() => DayAvailabilityDto)
  sunday: DayAvailabilityDto;
}

export class CreateDoctorDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dob?: Date;

  @IsString()
  @IsOptional()
  address?: string;

  @IsOptional()
  @IsArray()
  specializations?: string[];
  @IsString()
  @IsOptional()
  photoUrl?: string;

  @ApiProperty({ 
    description: 'Years of medical experience',
    example: 8,
    minimum: 0,
    maximum: 50,
    required: false
  })
  @IsNumber()
  @Min(0)
  @Max(50)
  @IsOptional()
  experience?: number;

  @IsObject()
  @ValidateNested()
  @Type(() => WeeklyAvailabilityDto)
  @IsOptional()
  availability?: WeeklyAvailabilityDto;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  timeSlots?: string[];
}
