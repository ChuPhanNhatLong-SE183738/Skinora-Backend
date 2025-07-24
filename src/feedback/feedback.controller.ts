import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../users/enums/role.enum';

@ApiTags('feedback')
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Get('/get-all-feedbacks')
  @UseGuards(JwtAuthGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Retrieve all feedback',
    description: 'Get a list of all feedback submissions',
  })
  async getAllFeedbacks() {
    try {
      const feedback = await this.feedbackService.findAll();
      return {
        success: true,
        message: 'Feedback retrieved successfully',
        data: feedback,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create new feedback',
    description: 'Submit feedback with rating and content',
  })
  @ApiBody({
    type: CreateFeedbackDto,
    description: 'Feedback data',
    examples: {
      example1: {
        summary: 'Positive feedback',
        value: {
          userId: '507f1f77bcf86cd799439012',
          content:
            'Great service! The doctor was very professional and helpful.',
          rating: 5,
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Feedback created successfully',
    schema: {
      example: {
        success: true,
        message: 'Feedback created successfully',
        data: {
          _id: '507f1f77bcf86cd799439015',
          userId: '507f1f77bcf86cd799439012',
          content:
            'Great service! The doctor was very professional and helpful.',
          rating: 5,
          createdAt: '2025-07-14T10:00:00.000Z',
          updatedAt: '2025-07-14T10:00:00.000Z',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid data' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  async create(@Body() createFeedbackDto: CreateFeedbackDto) {
    try {
      const feedback = await this.feedbackService.create(createFeedbackDto);
      return {
        success: true,
        message: 'Feedback created successfully',
        data: feedback,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @Get()
  @ApiOperation({
    summary: 'Get all feedback with optional filtering',
    description:
      'Retrieve all feedback with optional filters for user, rating, etc.',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'Filter by user ID',
    example: '507f1f77bcf86cd799439012',
  })
  @ApiQuery({
    name: 'rating',
    required: false,
    description: 'Filter by specific rating',
    example: 5,
  })
  @ApiQuery({
    name: 'minRating',
    required: false,
    description: 'Filter by minimum rating',
    example: 3,
  })
  @ApiQuery({
    name: 'maxRating',
    required: false,
    description: 'Filter by maximum rating',
    example: 5,
  })
  @ApiResponse({
    status: 200,
    description: 'Feedback retrieved successfully',
    schema: {
      example: {
        success: true,
        message: 'Feedback retrieved successfully',
        data: [
          {
            _id: '507f1f77bcf86cd799439015',
            userId: {
              _id: '507f1f77bcf86cd799439012',
              fullName: 'John Doe',
              email: 'john@example.com',
              profilePicture: 'https://example.com/profile.jpg',
            },
            content: 'Great service! The doctor was very professional.',
            rating: 5,
            createdAt: '2025-07-14T10:00:00.000Z',
            updatedAt: '2025-07-14T10:00:00.000Z',
          },
        ],
        total: 1,
      },
    },
  })
  async findAll(@Query() query: any) {
    const filters: any = {};

    if (query.userId) filters.userId = query.userId;
    if (query.rating) filters.rating = parseInt(query.rating);
    if (query.minRating) filters.minRating = parseInt(query.minRating);
    if (query.maxRating) filters.maxRating = parseInt(query.maxRating);

    const feedback = await this.feedbackService.findAll(
      Object.keys(filters).length > 0 ? filters : undefined,
    );

    return {
      success: true,
      message: 'Feedback retrieved successfully',
      data: feedback,
      total: feedback.length,
      filters: Object.keys(filters).length > 0 ? filters : null,
    };
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get feedback statistics',
    description: 'Get average rating and rating distribution statistics',
  })
  @ApiResponse({
    status: 200,
    description: 'Feedback statistics retrieved successfully',
    schema: {
      example: {
        success: true,
        message: 'Feedback statistics retrieved successfully',
        data: {
          averageRating: 4.2,
          totalFeedbacks: 150,
          ratingDistribution: [
            { rating: 1, count: 5 },
            { rating: 2, count: 10 },
            { rating: 3, count: 15 },
            { rating: 4, count: 50 },
            { rating: 5, count: 70 },
          ],
        },
      },
    },
  })
  async getStats() {
    const stats = await this.feedbackService.getRatingStats();
    return {
      success: true,
      message: 'Feedback statistics retrieved successfully',
      data: stats,
    };
  }

  @Get('user/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get feedback by user ID',
    description: 'Retrieve all feedback submitted by a specific user',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID',
    example: '507f1f77bcf86cd799439012',
  })
  @ApiResponse({
    status: 200,
    description: 'User feedback retrieved successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid user ID' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  async findByUser(@Param('userId') userId: string) {
    try {
      const feedback = await this.feedbackService.findByUser(userId);
      return {
        success: true,
        message: 'User feedback retrieved successfully',
        data: feedback,
        total: feedback.length,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get feedback by ID',
    description: 'Retrieve a specific feedback by its ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Feedback ID',
    example: '507f1f77bcf86cd799439015',
  })
  @ApiResponse({
    status: 200,
    description: 'Feedback found and returned successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid feedback ID',
  })
  @ApiResponse({ status: 404, description: 'Feedback not found' })
  async findOne(@Param('id') id: string) {
    try {
      const feedback = await this.feedbackService.findOne(id);
      return {
        success: true,
        message: 'Feedback retrieved successfully',
        data: feedback,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update feedback',
    description:
      'Update feedback content and/or rating. Users can only update their own feedback.',
  })
  @ApiParam({
    name: 'id',
    description: 'Feedback ID',
    example: '507f1f77bcf86cd799439015',
  })
  @ApiBody({
    type: UpdateFeedbackDto,
    description: 'Updated feedback data',
    examples: {
      example1: {
        summary: 'Update feedback content',
        value: {
          content: 'Updated feedback content - even better service!',
          rating: 5,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Feedback updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid data or feedback ID',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Can only update own feedback',
  })
  @ApiResponse({ status: 404, description: 'Feedback not found' })
  async update(
    @Param('id') id: string,
    @Body() updateFeedbackDto: UpdateFeedbackDto,
    @Request() req: any,
  ) {
    try {
      const feedback = await this.feedbackService.update(
        id,
        updateFeedbackDto,
        req.user?.id,
      );
      return {
        success: true,
        message: 'Feedback updated successfully',
        data: feedback,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete feedback',
    description: 'Delete feedback. Users can only delete their own feedback.',
  })
  @ApiParam({
    name: 'id',
    description: 'Feedback ID',
    example: '507f1f77bcf86cd799439015',
  })
  @ApiResponse({
    status: 200,
    description: 'Feedback deleted successfully',
    schema: {
      example: {
        success: true,
        message: 'Feedback deleted successfully',
        data: { deleted: true },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid feedback ID',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Can only delete own feedback',
  })
  @ApiResponse({ status: 404, description: 'Feedback not found' })
  async remove(@Param('id') id: string, @Request() req: any) {
    try {
      const result = await this.feedbackService.remove(id, req.user?.id);
      return {
        success: true,
        message: 'Feedback deleted successfully',
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
