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
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
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

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create new review',
    description: 'Add a review for a product',
  })
  @ApiBody({
    description: 'Review creation data',
    type: CreateReviewDto,
    examples: {
      example1: {
        summary: 'Product review',
        value: {
          productId: '67741234567890abcdef3333',
          content: 'Amazing moisturizer! My skin feels so soft and hydrated.',
          rating: 5,
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Review created successfully',
    schema: {
      example: {
        _id: '67741234567890abcdef7777',
        userId: '67741234567890abcdef5678',
        productId: '67741234567890abcdef3333',
        content: 'Amazing moisturizer! My skin feels so soft and hydrated.',
        rating: 5,
        isVerified: false,
        isActive: true,
        createdAt: '2025-01-06T15:30:00.000Z',
        updatedAt: '2025-01-06T15:30:00.000Z',
      },
    },
  })
  create(@Body() createReviewDto: CreateReviewDto, @Req() req) {
    const userId = req.user.userId || req.user._id || req.user.sub;
    return this.reviewsService.create(createReviewDto, userId);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all reviews',
    description: 'Retrieve all reviews with optional filtering',
  })
  @ApiQuery({
    name: 'productId',
    required: false,
    description: 'Filter by product ID',
    example: '67741234567890abcdef3333',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'Filter by user ID',
    example: '67741234567890abcdef5678',
  })
  @ApiQuery({
    name: 'rating',
    required: false,
    description: 'Filter by rating',
    example: 5,
  })
  @ApiQuery({
    name: 'isVerified',
    required: false,
    description: 'Filter by verification status',
    example: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Reviews retrieved successfully',
    schema: {
      example: [
        {
          _id: '67741234567890abcdef7777',
          userId: {
            _id: '67741234567890abcdef5678',
            fullName: 'John Doe',
            avatarUrl: 'https://example.com/avatar.jpg',
          },
          productId: {
            _id: '67741234567890abcdef3333',
            productName: 'Hydrating Daily Moisturizer',
            productImages: [
              {
                url: 'https://example.com/products/moisturizer-main.jpg',
                isPrimary: true,
              },
            ],
            brand: 'SkinCare Pro',
          },
          content: 'Amazing moisturizer! My skin feels so soft and hydrated.',
          rating: 5,
          isVerified: true,
          isActive: true,
          createdAt: '2025-01-06T15:30:00.000Z',
        },
      ],
    },
  })
  findAll(
    @Query('productId') productId?: string,
    @Query('userId') userId?: string,
    @Query('rating') rating?: number,
    @Query('isVerified') isVerified?: string,
  ) {
    const filters = { productId, userId, rating, isVerified };
    return this.reviewsService.findAll(filters);
  }

  @Get('product/:productId')
  @ApiOperation({
    summary: 'Get reviews by product',
    description: 'Retrieve all reviews for a specific product',
  })
  @ApiParam({
    name: 'productId',
    description: 'Product ObjectId',
    example: '67741234567890abcdef3333',
  })
  findByProduct(@Param('productId') productId: string) {
    return this.reviewsService.findByProduct(productId);
  }

  @Get('user/:userId')
  @ApiOperation({
    summary: 'Get reviews by user',
    description: 'Retrieve all reviews by a specific user',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ObjectId',
    example: '67741234567890abcdef5678',
  })
  findByUser(@Param('userId') userId: string) {
    return this.reviewsService.findByUser(userId);
  }

  @Get('product/:productId/stats')
  @ApiOperation({
    summary: 'Get product rating statistics',
    description: 'Get rating statistics for a specific product',
  })
  @ApiParam({
    name: 'productId',
    description: 'Product ObjectId',
    example: '67741234567890abcdef3333',
  })
  @ApiResponse({
    status: 200,
    description: 'Rating statistics retrieved successfully',
    schema: {
      example: {
        averageRating: 4.5,
        totalReviews: 23,
        ratingDistribution: {
          1: 0,
          2: 1,
          3: 2,
          4: 8,
          5: 12,
        },
      },
    },
  })
  getProductRatingStats(@Param('productId') productId: string) {
    return this.reviewsService.getProductRatingStats(productId);
  }

  @Get('my-reviews')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current user reviews',
    description: 'Retrieve all reviews by the current authenticated user',
  })
  getMyReviews(@Req() req) {
    const userId = req.user.userId || req.user._id || req.user.sub;
    return this.reviewsService.findByUser(userId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get review by ID',
    description: 'Retrieve a specific review by ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Review ObjectId',
    example: '67741234567890abcdef7777',
  })
  findOne(@Param('id') id: string) {
    return this.reviewsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update review',
    description: 'Update a review (only by the review owner)',
  })
  @ApiParam({
    name: 'id',
    description: 'Review ObjectId',
    example: '67741234567890abcdef7777',
  })
  @ApiBody({
    description: 'Review update data',
    type: UpdateReviewDto,
    examples: {
      example1: {
        summary: 'Update review content',
        value: {
          content:
            'Updated review: Still loving this moisturizer after 2 months!',
          rating: 5,
        },
      },
    },
  })
  update(
    @Param('id') id: string,
    @Body() updateReviewDto: UpdateReviewDto,
    @Req() req,
  ) {
    const userId = req.user.userId || req.user._id || req.user.sub;
    return this.reviewsService.update(id, updateReviewDto, userId);
  }

  @Patch(':id/toggle-verified')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Toggle review verification (Admin only)',
    description: 'Mark a review as verified or unverified',
  })
  @ApiParam({
    name: 'id',
    description: 'Review ObjectId',
    example: '67741234567890abcdef7777',
  })
  toggleVerified(@Param('id') id: string) {
    return this.reviewsService.toggleVerified(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete review',
    description: 'Delete a review (only by the review owner)',
  })
  @ApiParam({
    name: 'id',
    description: 'Review ObjectId',
    example: '67741234567890abcdef7777',
  })
  @ApiResponse({
    status: 200,
    description: 'Review deleted successfully',
    schema: {
      example: {
        deleted: true,
      },
    },
  })
  remove(@Param('id') id: string, @Req() req) {
    const userId = req.user.userId || req.user._id || req.user.sub;
    return this.reviewsService.remove(id, userId);
  }
}
