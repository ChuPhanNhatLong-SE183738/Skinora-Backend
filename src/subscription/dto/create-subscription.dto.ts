import {
  IsString,
  IsNumber,
  IsDateString,
  IsMongoId,
  IsOptional,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSubscriptionDto {
  @ApiProperty({ description: 'Subscription plan ID to purchase' })
  @IsMongoId()
  planId: string;

  @ApiProperty({ description: 'Subscription start date', required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;
}
