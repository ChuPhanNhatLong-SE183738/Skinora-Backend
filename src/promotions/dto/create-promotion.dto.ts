import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  Max,
  IsBoolean,
  IsOptional,
  IsArray,
  IsDateString,
  IsMongoId,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePromotionDto {
  @ApiProperty({
    description: 'Promotion title',
    example: 'Summer Sale 2025',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Detailed description of the promotion',
    example: 'Get up to 30% off on all skincare products this summer!',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    description: 'Discount percentage (0-100)',
    example: 30,
    minimum: 0,
    maximum: 100,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercentage: number;

  @ApiProperty({
    description: 'Promotion start date',
    example: '2025-06-01T00:00:00.000Z',
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: 'Promotion end date',
    example: '2025-08-31T23:59:59.000Z',
  })
  @IsDateString()
  endDate: string;

  @ApiProperty({
    description: 'Whether the promotion is active',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description: 'Array of product IDs this promotion applies to',
    type: [String],
    required: false,
    example: ['67741234567890abcdef3333', '67741234567890abcdef4444'],
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({
    each: true,
    message: 'Each product ID must be a valid MongoDB ObjectId',
  })
  applicableProducts?: string[];

  @ApiProperty({
    description: 'Array of categories this promotion applies to',
    type: [String],
    required: false,
    example: ['moisturizer', 'cleanser', 'serum'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true, message: 'Category names cannot be empty' })
  applicableCategories?: string[];

  @ApiProperty({
    description: 'Minimum purchase amount to apply promotion',
    example: 500000,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumPurchase?: number;

  @ApiProperty({
    description: 'Maximum discount amount',
    example: 1000000,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maximumDiscount?: number;

  @ApiProperty({
    description: 'Maximum number of times this promotion can be used',
    example: 100,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  usageLimit?: number;

  @ApiProperty({
    description: 'Promotional code for customers to use',
    example: 'SUMMER30',
    required: false,
  })
  @IsOptional()
  @IsString()
  promoCode?: string;

  @ApiProperty({
    description: 'Type of discount',
    example: 'percentage',
    enum: ['percentage', 'fixed'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['percentage', 'fixed'])
  discountType?: string;
}
