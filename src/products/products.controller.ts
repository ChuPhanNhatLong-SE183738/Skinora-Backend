import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create new product',
    description: 'Add a new skincare product to the catalog',
  })
  @ApiBody({
    description: 'Product creation data',
    type: CreateProductDto,
    examples: {
      example1: {
        summary: 'Moisturizer product',
        value: {
          productName: 'Hydrating Daily Moisturizer',
          productDescription:
            'A lightweight, non-greasy moisturizer perfect for daily use. Provides 24-hour hydration.',
          productImages: [
            {
              url: 'https://example.com/products/moisturizer-main.jpg',
              alt: 'Hydrating Daily Moisturizer - Main Image',
              isPrimary: true,
            },
            {
              url: 'https://example.com/products/moisturizer-ingredients.jpg',
              alt: 'Ingredients List',
              isPrimary: false,
            },
          ],
          ingredients: [
            {
              name: 'Hyaluronic Acid',
              percentage: 2.0,
              purpose: 'Deep hydration and plumping',
            },
            {
              name: 'Niacinamide',
              percentage: 5.0,
              purpose: 'Pore minimizing and oil control',
            },
            {
              name: 'Ceramides',
              percentage: 1.0,
              purpose: 'Skin barrier repair',
            },
          ],
          category: ['moisturizer', 'face-care', 'hydrating'],
          brand: 'SkinCare Pro',
          price: 299000,
          stock: 100,
          suitableFor: 'all skin types',
          expiryDate: '2026-12-31',
          isActive: true,
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Product created successfully',
    schema: {
      example: {
        _id: '67741234567890abcdef3333',
        productName: 'Hydrating Daily Moisturizer',
        productDescription:
          'A lightweight, non-greasy moisturizer perfect for daily use.',
        productImages: [
          {
            url: 'https://example.com/products/moisturizer-main.jpg',
            alt: 'Hydrating Daily Moisturizer - Main Image',
            isPrimary: true,
          },
        ],
        ingredients: [
          {
            name: 'Hyaluronic Acid',
            percentage: 2.0,
            purpose: 'Deep hydration and plumping',
          },
        ],
        category: ['moisturizer', 'face-care', 'hydrating'],
        brand: 'SkinCare Pro',
        price: 299000,
        stock: 100,
        suitableFor: 'all skin types',
        reviews: [],
        averageRating: 0,
        totalReviews: 0,
        isActive: true,
        createdAt: '2025-01-06T12:00:00.000Z',
        updatedAt: '2025-01-06T12:00:00.000Z',
      },
    },
  })
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all products',
    description:
      'Retrieve a list of all products with optional filtering and pagination',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    description: 'Filter by product category',
    example: 'moisturizer',
  })
  @ApiQuery({
    name: 'brand',
    required: false,
    description: 'Filter by brand name',
    example: 'SkinCare Pro',
  })
  @ApiQuery({
    name: 'suitableFor',
    required: false,
    description: 'Filter by skin type',
    example: 'oily',
  })
  @ApiQuery({
    name: 'minPrice',
    required: false,
    description: 'Minimum price filter',
    example: 100000,
  })
  @ApiQuery({
    name: 'maxPrice',
    required: false,
    description: 'Maximum price filter',
    example: 500000,
  })
  @ApiResponse({
    status: 200,
    description: 'Products retrieved successfully',
    schema: {
      example: {
        products: [
          {
            _id: '67741234567890abcdef3333',
            productName: 'Hydrating Daily Moisturizer',
            productDescription:
              'A lightweight, non-greasy moisturizer perfect for daily use.',
            productImages: [
              {
                url: 'https://example.com/products/moisturizer-main.jpg',
                alt: 'Hydrating Daily Moisturizer',
                isPrimary: true,
              },
            ],
            category: ['moisturizer', 'face-care'],
            brand: 'SkinCare Pro',
            price: 299000,
            stock: 100,
            suitableFor: 'all skin types',
            averageRating: 4.5,
            totalReviews: 23,
            isActive: true,
          },
          {
            _id: '67741234567890abcdef4444',
            productName: 'Oil Control Cleanser',
            productDescription:
              'Deep cleansing foam for oily and acne-prone skin.',
            productImages: [
              {
                url: 'https://example.com/products/cleanser-main.jpg',
                alt: 'Oil Control Cleanser',
                isPrimary: true,
              },
            ],
            category: ['cleanser', 'face-care', 'oil-control'],
            brand: 'Clear Skin',
            price: 199000,
            stock: 75,
            suitableFor: 'oily skin',
            averageRating: 4.2,
            totalReviews: 15,
            isActive: true,
          },
        ],
        totalCount: 2,
        page: 1,
        limit: 10,
      },
    },
  })
  findAll() {
    return this.productsService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get product by ID',
    description: 'Retrieve detailed information about a specific product',
  })
  @ApiParam({
    name: 'id',
    description: 'MongoDB ObjectId of the product',
    example: '67741234567890abcdef3333',
  })
  @ApiResponse({
    status: 200,
    description: 'Product found and returned successfully',
    schema: {
      example: {
        _id: '67741234567890abcdef3333',
        productName: 'Hydrating Daily Moisturizer',
        productDescription:
          'A lightweight, non-greasy moisturizer perfect for daily use. Provides 24-hour hydration with a blend of hyaluronic acid and ceramides.',
        productImages: [
          {
            url: 'https://example.com/products/moisturizer-main.jpg',
            alt: 'Hydrating Daily Moisturizer - Main Image',
            isPrimary: true,
          },
          {
            url: 'https://example.com/products/moisturizer-texture.jpg',
            alt: 'Product texture close-up',
            isPrimary: false,
          },
        ],
        ingredients: [
          {
            name: 'Hyaluronic Acid',
            percentage: 2.0,
            purpose: 'Deep hydration and plumping',
          },
          {
            name: 'Niacinamide',
            percentage: 5.0,
            purpose: 'Pore minimizing and oil control',
          },
        ],
        category: ['moisturizer', 'face-care', 'hydrating'],
        brand: 'SkinCare Pro',
        price: 299000,
        stock: 100,
        suitableFor: 'all skin types',
        reviews: [
          {
            userId: '67741234567890abcdef5678',
            rating: 5,
            comment: 'Amazing moisturizer! My skin feels so soft and hydrated.',
            reviewDate: '2025-01-05T14:30:00.000Z',
            isVerified: true,
          },
          {
            userId: '67741234567890abcdef9999',
            rating: 4,
            comment: 'Good product, lightweight and absorbs quickly.',
            reviewDate: '2025-01-04T09:15:00.000Z',
            isVerified: true,
          },
        ],
        expiryDate: '2026-12-31T00:00:00.000Z',
        averageRating: 4.5,
        totalReviews: 23,
        isActive: true,
        createdAt: '2024-11-01T10:00:00.000Z',
        updatedAt: '2025-01-06T12:00:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Product not found',
    schema: {
      example: {
        message: 'Product not found',
        statusCode: 404,
      },
    },
  })
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update product',
    description: 'Update product information by ID',
  })
  @ApiParam({
    name: 'id',
    description: 'MongoDB ObjectId of the product to update',
    example: '67741234567890abcdef3333',
  })
  @ApiBody({
    description: 'Product update data (all fields optional)',
    type: UpdateProductDto,
    examples: {
      example1: {
        summary: 'Update price and stock',
        value: {
          price: 349000,
          stock: 150,
        },
      },
      example2: {
        summary: 'Update product details',
        value: {
          productDescription:
            'Updated description with new benefits and improved formula.',
          suitableFor: 'all skin types, especially dry skin',
          isActive: true,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Product updated successfully',
    schema: {
      example: {
        _id: '67741234567890abcdef3333',
        productName: 'Hydrating Daily Moisturizer',
        productDescription:
          'Updated description with new benefits and improved formula.',
        price: 349000,
        stock: 150,
        suitableFor: 'all skin types, especially dry skin',
        updatedAt: '2025-01-06T13:00:00.000Z',
      },
    },
  })
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(+id, updateProductDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete product',
    description: 'Permanently delete a product from the catalog',
  })
  @ApiParam({
    name: 'id',
    description: 'MongoDB ObjectId of the product to delete',
    example: '67741234567890abcdef3333',
  })
  @ApiResponse({
    status: 200,
    description: 'Product deleted successfully',
    schema: {
      example: {
        message: 'Product deleted successfully',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Product not found',
    schema: {
      example: {
        message: 'Product not found',
        statusCode: 404,
      },
    },
  })
  remove(@Param('id') id: string) {
    return this.productsService.remove(+id);
  }
}
