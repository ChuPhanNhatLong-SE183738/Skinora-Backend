import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSubscriptionPlanDto {
  @ApiProperty({ description: 'Plan name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Plan description' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Monthly price' })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ description: 'Duration in months' })
  @IsNumber()
  @Min(1)
  duration: number;

  @ApiProperty({ description: 'AI usage tokens included' })
  @IsNumber()
  @Min(0)
  aiUsageAmount: number;

  @ApiProperty({ description: 'Number of meetings allowed' })
  @IsNumber()
  @Min(0)
  meetingAmount: number;

  @ApiProperty({ description: 'Is plan active', required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ description: 'Sort order for display', required: false })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}
