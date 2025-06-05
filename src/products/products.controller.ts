import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AddReviewDto } from './dto/add-review.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../users/enums/role.enum';
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create new product (Admin only)',
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
          categories: ['67741234567890abcdef1111', '67741234567890abcdef2222'],
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
        categories: [
          {
            _id: '67741234567890abcdef1111',
            name: 'Moisturizer',
            slug: 'moisturizer',
          },
        ],
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
    description: 'Filter by category ID',
    example: '67741234567890abcdef1111',
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
            categories: [
              {
                _id: '67741234567890abcdef1111',
                categoryName: 'Moisturizers',
                slug: 'moisturizers',
              },
            ],
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
            categories: [
              {
                _id: '67741234567890abcdef2222',
                categoryName: 'Cleansers',
                slug: 'cleansers',
              },
            ],
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
  findAll(
    @Query('category') category?: string,
    @Query('brand') brand?: string,
    @Query('suitableFor') suitableFor?: string,
    @Query('minPrice') minPrice?: number,
    @Query('maxPrice') maxPrice?: number,
  ) {
    const filters = { category, brand, suitableFor, minPrice, maxPrice };
    return this.productsService.findAll(filters);
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search products',
    description: 'Search products by name, description, brand, or category',
  })
  @ApiQuery({
    name: 'q',
    description: 'Search query',
    example: 'moisturizer',
  })
  @ApiResponse({
    status: 200,
    description: 'Search results retrieved successfully',
    schema: {
      example: [
        {
          _id: '67741234567890abcdef3333',
          productName: 'Hydrating Daily Moisturizer',
          productDescription:
            'A lightweight, non-greasy moisturizer perfect for daily use.',
          categories: [
            {
              _id: '67741234567890abcdef1111',
              categoryName: 'Moisturizers',
              slug: 'moisturizers',
            },
          ],
          brand: 'SkinCare Pro',
          price: 299000,
          averageRating: 4.5,
          totalReviews: 23,
        },
      ],
    },
  })
  searchProducts(@Query('q') searchTerm: string) {
    return this.productsService.searchProducts(searchTerm);
  }

  @Get('category/:categoryId')
  @ApiOperation({
    summary: 'Get products by category',
    description: 'Retrieve all products in a specific category',
  })
  @ApiParam({
    name: 'categoryId',
    description: 'Category ObjectId',
    example: '67741234567890abcdef1111',
  })
  getProductsByCategory(@Param('categoryId') categoryId: string) {
    return this.productsService.getProductsByCategory(categoryId);
  }

  @Get('skin-type/:skinType')
  @ApiOperation({
    summary: 'Get products by skin type',
    description: 'Retrieve all products suitable for a specific skin type',
  })
  @ApiParam({
    name: 'skinType',
    description: 'Skin type',
    example: 'oily',
  })
  getProductsBySkinType(@Param('skinType') skinType: string) {
    return this.productsService.getProductsBySkinType(skinType);
  }

  @Get('featured')
  @ApiOperation({
    summary: 'Get featured products',
    description: 'Retrieve top-rated and popular products',
  })
  @ApiResponse({
    status: 200,
    description: 'Featured products retrieved successfully',
    schema: {
      example: [
        {
          _id: '67741234567890abcdef3333',
          productName: 'Hydrating Daily Moisturizer',
          averageRating: 4.8,
          totalReviews: 156,
          price: 299000,
        },
      ],
    },
  })
  getFeaturedProducts() {
    return this.productsService.getFeaturedProducts();
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
        categories: [
          {
            _id: '67741234567890abcdef1111',
            name: 'Moisturizer',
            slug: 'moisturizer',
          },
          {
            _id: '67741234567890abcdef2222',
            name: 'Face Care',
            slug: 'face-care',
          },
        ],
        brand: 'SkinCare Pro',
        price: 299000,
        stock: 100,
        suitableFor: 'all skin types',
        reviews: [
          {
            userId: {
              _id: '67741234567890abcdef5678',
              fullName: 'John Doe',
              avatarUrl: 'https://example.com/avatar.jpg',
            },
            rating: 5,
            comment: 'Amazing moisturizer! My skin feels so soft and hydrated.',
            reviewDate: '2025-01-05T14:30:00.000Z',
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
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
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
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
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
    return this.productsService.remove(id);
  }

  @Post(':id/reviews')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Add product review',
    description: 'Add a review and rating for a product',
  })
  @ApiParam({
    name: 'id',
    description: 'MongoDB ObjectId of the product',
    example: '67741234567890abcdef3333',
  })
  @ApiBody({
    description: 'Review data',
    type: AddReviewDto,
    examples: {
      example1: {
        summary: 'Product review',
        value: {
          rating: 5,
          comment:
            'Amazing moisturizer! My skin feels so soft and hydrated after using it for a week.',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Review added successfully',
    schema: {
      example: {
        _id: '67741234567890abcdef3333',
        productName: 'Hydrating Daily Moisturizer',
        reviews: [
          {
            userId: '67741234567890abcdef5678',
            rating: 5,
            comment: 'Amazing moisturizer! My skin feels so soft and hydrated.',
            reviewDate: '2025-01-06T15:30:00.000Z',
            isVerified: false,
          },
        ],
        averageRating: 4.6,
        totalReviews: 24,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - User already reviewed this product',
    schema: {
      example: {
        message: 'User has already reviewed this product',
        error: 'Bad Request',
        statusCode: 400,
      },
    },
  })
  addReview(
    @Param('id') productId: string,
    @Body() addReviewDto: AddReviewDto,
    @Req() req,
  ) {
    const userId = req.user.userId || req.user._id || req.user.sub;
    return this.productsService.addReview(productId, userId, addReviewDto);
  }

  @Patch(':id/stock')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update product stock (Admin only)',
    description: 'Update the stock quantity of a product',
  })
  @ApiParam({
    name: 'id',
    description: 'MongoDB ObjectId of the product',
    example: '67741234567890abcdef3333',
  })
  @ApiBody({
    description: 'Stock update data',
    schema: {
      type: 'object',
      properties: {
        quantity: {
          type: 'number',
          description: 'Quantity to add (positive) or subtract (negative)',
          example: 50,
        },
      },
      required: ['quantity'],
    },
    examples: {
      example1: {
        summary: 'Add stock',
        value: { quantity: 50 },
      },
      example2: {
        summary: 'Reduce stock',
        value: { quantity: -10 },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Stock updated successfully',
    schema: {
      example: {
        _id: '67741234567890abcdef3333',
        productName: 'Hydrating Daily Moisturizer',
        stock: 150,
        updatedAt: '2025-01-06T16:00:00.000Z',
      },
    },
  })
  updateStock(@Param('id') id: string, @Body('quantity') quantity: number) {
    return this.productsService.updateStock(id, quantity);
  }
}
