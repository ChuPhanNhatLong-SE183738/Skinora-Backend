import { IsMongoId, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePaymentDto {
  @ApiProperty({
    description: 'Subscription ID to pay for',
    required: false,
  })
  @IsOptional()
  @IsMongoId()
  subscriptionId?: string;

  @ApiProperty({
    description: 'Plan ID to purchase (alternative to subscriptionId)',
    required: false,
  })
  @IsOptional()
  @IsMongoId()
  planId?: string;

  @ApiProperty({ description: 'Payment description', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
