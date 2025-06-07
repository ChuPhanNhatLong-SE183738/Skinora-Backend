import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSubscriptionDto {
  @ApiProperty({ description: 'Subscription status', required: false })
  @IsOptional()
  @IsEnum(['pending', 'active', 'expired', 'cancelled'])
  status?: string;

  @ApiProperty({ description: 'AI usage used', required: false })
  @IsOptional()
  aiUsageUsed?: number;

  @ApiProperty({ description: 'Meetings used', required: false })
  @IsOptional()
  meetingsUsed?: number;
}
