import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsOptional,
  IsNumber,
  Min,
  IsDateString,
  IsBoolean,
  IsMongoId,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ProductImageDto {
  @ApiProperty({
    description: 'Image URL',
    example: 'https://example.com/products/moisturizer-main.jpg',
  })
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiProperty({
    description: 'Image alt text',
    example: 'Hydrating Daily Moisturizer - Main Image',
    required: false,
  })
  @IsOptional()
  @IsString()
  alt?: string;

  @ApiProperty({
    description: 'Whether this is the primary product image',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class IngredientDto {
  @ApiProperty({
    description: 'Ingredient name',
    example: 'Hyaluronic Acid',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Percentage of ingredient in product',
    example: 2.0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  percentage?: number;

  @ApiProperty({
    description: 'Purpose or benefit of this ingredient',
    example: 'Deep hydration and plumping',
    required: false,
  })
  @IsOptional()
  @IsString()
  purpose?: string;
}

export class CreateProductDto {
  @ApiProperty({
    description: 'Product name',
    example: 'Hydrating Daily Moisturizer',
  })
  @IsString({ message: 'Product name must be a string' })
  @IsNotEmpty({ message: 'Product name should not be empty' })
  productName: string;

  @ApiProperty({
    description:
      'Detailed product description, example: A lightweight, non-greasy moisturizer perfect for daily use. Provides 24-hour hydration with a blend of hyaluronic acid and ceramides.',
  })
  @IsString({ message: 'Product description must be a string' })
  @IsNotEmpty({ message: 'Product description should not be empty' })
  productDescription: string;

  @ApiProperty({
    description: 'Array of product images',
    type: [ProductImageDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImageDto)
  productImages?: ProductImageDto[];

  @ApiProperty({
    description: 'Array of product ingredients',
    type: [IngredientDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngredientDto)
  ingredients?: IngredientDto[];

  @ApiProperty({
    description: 'Array of category IDs this product belongs to',
    type: [String],
    example: ['677412..........1111', '677412..........2222'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({
    each: true,
    message: 'Each category must be a valid MongoDB ObjectId',
  })
  categories?: string[];

  @ApiProperty({
    description: 'Brand name',
    example: 'SkinCare Pro',
  })
  @IsString({ message: 'Brand must be a string' })
  @IsNotEmpty({ message: 'Brand should not be empty' })
  brand: string;

  @ApiProperty({
    description: 'Product price in VND',
    example: 299000,
  })
  @IsNumber({}, { message: 'Price must be a number' })
  @Min(0, { message: 'Price must not be less than 0' })
  price: number;

  @ApiProperty({
    description: 'Stock quantity',
    example: 100,
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Stock must be a number' })
  @Min(0, { message: 'Stock must not be less than 0' })
  stock?: number;

  @ApiProperty({
    description: 'Skin types this product is suitable for',
    example: 'all skin types, oily skin, acne-prone skin',
  })
  @IsString({ message: 'SuitableFor must be a string' })
  @IsNotEmpty({ message: 'SuitableFor should not be empty' })
  suitableFor: string;

  @ApiProperty({
    description: 'Product expiry date',
    example: '2026-12-31',
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: 'Expiry date must be a valid date string' })
  expiryDate?: string;

  @ApiProperty({
    description: 'Promotion ID if product is on promotion',
    example: '677412..........3333',
    required: false,
  })
  @IsOptional()
  @IsMongoId({ message: 'Promotion ID must be a valid MongoDB ObjectId' })
  promotionId?: string;

  @ApiProperty({
    description: 'Whether the product is active/visible',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'IsActive must be a boolean' })
  isActive?: boolean;
}
