import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { PromotionsService } from './promotions.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
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
} from '@nestjs/swagger';
import { successResponse } from 'src/helper/response.helper';

@ApiTags('promotions')
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create new promotion',
    description: 'Create a new promotional campaign (Admin only)',
  })
  @ApiBody({
    description: 'Promotion creation data',
    type: CreatePromotionDto,
    examples: {
      example1: {
        summary: 'Summer promotion',
        value: {
          title: 'Summer Sale 2025',
          description:
            'Get up to 30% off on all skincare products this summer!',
          discountPercentage: 30,
          startDate: '2025-06-01T00:00:00.000Z',
          endDate: '2025-08-31T23:59:59.000Z',
          isActive: true,
          applicableCategories: ['moisturizer', 'cleanser'],
          minimumPurchase: 500000,
          maximumDiscount: 1000000,
          usageLimit: 100,
          promoCode: 'SUMMER30',
          discountType: 'percentage',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Promotion created successfully',
    schema: {
      example: {
        _id: '67741234567890abcdef5555',
        title: 'Summer Sale 2025',
        description: 'Get up to 30% off on all skincare products this summer!',
        discountPercentage: 30,
        startDate: '2025-06-01T00:00:00.000Z',
        endDate: '2025-08-31T23:59:59.000Z',
        isActive: true,
        applicableProducts: [],
        applicableCategories: ['moisturizer', 'cleanser'],
        minimumPurchase: 500000,
        maximumDiscount: 1000000,
        usageCount: 0,
        usageLimit: 100,
        promoCode: 'SUMMER30',
        discountType: 'percentage',
        createdAt: '2025-01-06T14:00:00.000Z',
        updatedAt: '2025-01-06T14:00:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid product IDs or categories',
    schema: {
      example: {
        message:
          'Product(s) not found: 67741234567890abcdef9999, 67741234567890abcdef8888',
        error: 'Bad Request',
        statusCode: 400,
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Admin access required',
    schema: {
      example: {
        message: 'Forbidden resource',
        error: 'Forbidden',
        statusCode: 403,
      },
    },
  })
  create(@Body() createPromotionDto: CreatePromotionDto) {
    return this.promotionsService.create(createPromotionDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all promotions',
    description: 'Retrieve a list of all promotional campaigns',
  })
  @ApiResponse({
    status: 200,
    description: 'Promotions retrieved successfully',
    schema: {
      example: [
        {
          _id: '67741234567890abcdef5555',
          title: 'Summer Sale 2025',
          description:
            'Get up to 30% off on all skincare products this summer!',
          discountPercentage: 30,
          startDate: '2025-06-01T00:00:00.000Z',
          endDate: '2025-08-31T23:59:59.000Z',
          isActive: true,
          applicableProducts: [],
          applicableCategories: ['moisturizer', 'cleanser'],
          minimumPurchase: 500000,
          maximumDiscount: 1000000,
          usageCount: 15,
          usageLimit: 100,
          promoCode: 'SUMMER30',
          discountType: 'percentage',
        },
      ],
    },
  })
  findAll() {
    return this.promotionsService.findAll();
  }

  @Get('active')
  @ApiOperation({
    summary: 'Get active promotions',
    description: 'Retrieve all currently active promotional campaigns',
  })
  @ApiResponse({
    status: 200,
    description: 'Active promotions retrieved successfully',
    schema: {
      example: [
        {
          _id: '67741234567890abcdef5555',
          title: 'Summer Sale 2025',
          description:
            'Get up to 30% off on all skincare products this summer!',
          discountPercentage: 30,
          startDate: '2025-06-01T00:00:00.000Z',
          endDate: '2025-08-31T23:59:59.000Z',
          isActive: true,
          usageCount: 15,
          usageLimit: 100,
          promoCode: 'SUMMER30',
        },
      ],
    },
  })
  findActive() {
    return this.promotionsService.findActive();
  }

  @Get('code/:promoCode')
  @ApiOperation({
    summary: 'Get promotion by promo code',
    description: 'Retrieve promotion details using promo code',
  })
  @ApiParam({
    name: 'promoCode',
    description: 'Promotional code',
    example: 'SUMMER30',
  })
  @ApiResponse({
    status: 200,
    description: 'Promotion found',
    schema: {
      example: {
        _id: '67741234567890abcdef5555',
        title: 'Summer Sale 2025',
        description: 'Get up to 30% off on all skincare products this summer!',
        discountPercentage: 30,
        startDate: '2025-06-01T00:00:00.000Z',
        endDate: '2025-08-31T23:59:59.000Z',
        isActive: true,
        promoCode: 'SUMMER30',
        minimumPurchase: 500000,
        maximumDiscount: 1000000,
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Promotion not found or expired',
  })
  findByPromoCode(@Param('promoCode') promoCode: string) {
    return this.promotionsService.findByPromoCode(promoCode);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get promotion by ID',
    description: 'Retrieve detailed information about a specific promotion',
  })
  @ApiParam({
    name: 'id',
    description: 'MongoDB ObjectId of the promotion',
    example: '67741234567890abcdef5555',
  })
  @ApiResponse({
    status: 200,
    description: 'Promotion found and returned successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Promotion not found',
  })
  findOne(@Param('id') id: string) {
    return this.promotionsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update promotion',
    description: 'Update promotion information by ID (Admin only)',
  })
  @ApiParam({
    name: 'id',
    description: 'MongoDB ObjectId of the promotion to update',
    example: '67741234567890abcdef5555',
  })
  @ApiBody({
    description: 'Promotion update data (all fields optional)',
    type: UpdatePromotionDto,
    examples: {
      example1: {
        summary: 'Update promotion status',
        value: {
          isActive: false,
        },
      },
      example2: {
        summary: 'Extend promotion',
        value: {
          endDate: '2025-09-30T23:59:59.000Z',
          discountPercentage: 40,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Promotion updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid product IDs or categories',
    schema: {
      example: {
        message:
          'Category(ies) not found: invalid-category, non-existent-category',
        error: 'Bad Request',
        statusCode: 400,
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Promotion not found',
    schema: {
      example: {
        message: 'Promotion with ID 67741234567890abcdef5555 not found',
        error: 'Not Found',
        statusCode: 404,
      },
    },
  })
  update(
    @Param('id') id: string,
    @Body() updatePromotionDto: UpdatePromotionDto,
  ) {
    return this.promotionsService.update(id, updatePromotionDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete promotion',
    description: 'Permanently delete a promotional campaign (Admin only)',
  })
  @ApiParam({
    name: 'id',
    description: 'MongoDB ObjectId of the promotion to delete',
    example: '67741234567890abcdef5555',
  })
  @ApiResponse({
    status: 200,
    description: 'Promotion deleted successfully',
    schema: {
      example: {
        deleted: true,
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Promotion not found',
  })
  remove(@Param('id') id: string) {
    return this.promotionsService.remove(id);
  }
}
