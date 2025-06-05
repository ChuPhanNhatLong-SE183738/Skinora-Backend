import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsOptional,
  IsMongoId,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class RecommendationDto {
  @ApiProperty({
    description: 'MongoDB ObjectId of the recommended product',
    example: '67741234567890abcdef9999',
  })
  @IsMongoId()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({
    description: 'Explanation of why this product is recommended',
    example:
      'Suitable for oily skin type - Oil-control cleanser with salicylic acid',
  })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class CreateAnalyseDto {
  @ApiProperty({
    description: 'MongoDB ObjectId of the user',
    example: '67741234567890abcdef5678',
  })
  @IsMongoId()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'URL of the uploaded skin image',
    example:
      'http://localhost:3000/uploads/skin-analysis/1704538200000-123456789.jpg',
  })
  @IsString()
  @IsNotEmpty()
  imageUrl: string;

  @ApiProperty({
    description: 'Detected skin type from AI analysis',
    example: 'Acne',
    enum: ['Acne', 'Eczema', 'Normal', 'Psoriasis'],
  })
  @IsString()
  @IsNotEmpty()
  skinType: string;

  @ApiProperty({
    description: 'Detailed analysis result with confidence level',
    example: 'Your skin type is oily with 87.5% confidence',
  })
  @IsString()
  @IsNotEmpty()
  result: string;

  @ApiProperty({
    description:
      'Array of recommended products based on skin type (for creation only)',
    type: [RecommendationDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecommendationDto)
  recommendedProducts?: RecommendationDto[];
}
