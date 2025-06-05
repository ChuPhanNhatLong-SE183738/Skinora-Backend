import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
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

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create new category (Admin only)',
    description: 'Add a new product category',
  })
  @ApiBody({
    description: 'Category creation data',
    type: CreateCategoryDto,
    examples: {
      example1: {
        summary: 'Moisturizer category',
        value: {
          categoryName: 'Moisturizers',
          slug: 'moisturizers',
          description: 'Hydrating products for all skin types',
          imageUrl: 'https://example.com/categories/moisturizers.jpg',
          isActive: true,
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Category created successfully',
    schema: {
      example: {
        _id: '67741234567890abcdef1111',
        categoryName: 'Moisturizers',
        slug: 'moisturizers',
        description: 'Hydrating products for all skin types',
        imageUrl: 'https://example.com/categories/moisturizers.jpg',
        isActive: true,
        createdAt: '2025-01-06T12:00:00.000Z',
        updatedAt: '2025-01-06T12:00:00.000Z',
      },
    },
  })
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(createCategoryDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all categories',
    description: 'Retrieve all active categories',
  })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    description: 'Include inactive categories (Admin only)',
    example: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Categories retrieved successfully',
    schema: {
      example: [
        {
          _id: '67741234567890abcdef1111',
          categoryName: 'Moisturizers',
          slug: 'moisturizers',
          description: 'Hydrating products for all skin types',
          imageUrl: 'https://example.com/categories/moisturizers.jpg',
          isActive: true,
        },
        {
          _id: '67741234567890abcdef2222',
          categoryName: 'Cleansers',
          slug: 'cleansers',
          description: 'Cleansing products for daily skincare routine',
          imageUrl: 'https://example.com/categories/cleansers.jpg',
          isActive: true,
        },
      ],
    },
  })
  findAll(@Query('includeInactive') includeInactive?: boolean) {
    if (includeInactive) {
      return this.categoriesService.findAllIncludeInactive();
    }
    return this.categoriesService.findAll();
  }

  @Get('slug/:slug')
  @ApiOperation({
    summary: 'Get category by slug',
    description: 'Retrieve category information by slug',
  })
  @ApiParam({
    name: 'slug',
    description: 'Category slug',
    example: 'moisturizers',
  })
  findBySlug(@Param('slug') slug: string) {
    return this.categoriesService.findBySlug(slug);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get category by ID',
    description: 'Retrieve category information by ID',
  })
  @ApiParam({
    name: 'id',
    description: 'MongoDB ObjectId of the category',
    example: '67741234567890abcdef1111',
  })
  @ApiResponse({
    status: 200,
    description: 'Category found successfully',
    schema: {
      example: {
        _id: '67741234567890abcdef1111',
        categoryName: 'Moisturizers',
        slug: 'moisturizers',
        description: 'Hydrating products for all skin types',
        imageUrl: 'https://example.com/categories/moisturizers.jpg',
        isActive: true,
        createdAt: '2025-01-01T10:00:00.000Z',
        updatedAt: '2025-01-06T12:00:00.000Z',
      },
    },
  })
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update category (Admin only)',
    description: 'Update category information',
  })
  @ApiParam({
    name: 'id',
    description: 'MongoDB ObjectId of the category',
    example: '67741234567890abcdef1111',
  })
  @ApiBody({
    description: 'Category update data (all fields optional)',
    type: UpdateCategoryDto,
    examples: {
      example1: {
        summary: 'Update description',
        value: {
          description: 'Updated description for moisturizing products',
        },
      },
    },
  })
  update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  @Patch(':id/toggle-active')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Toggle category active status (Admin only)',
    description: 'Activate or deactivate a category',
  })
  @ApiParam({
    name: 'id',
    description: 'MongoDB ObjectId of the category',
    example: '67741234567890abcdef1111',
  })
  toggleActive(@Param('id') id: string) {
    return this.categoriesService.toggleActive(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete category (Admin only)',
    description: 'Permanently delete a category',
  })
  @ApiParam({
    name: 'id',
    description: 'MongoDB ObjectId of the category',
    example: '67741234567890abcdef1111',
  })
  @ApiResponse({
    status: 200,
    description: 'Category deleted successfully',
    schema: {
      example: {
        deleted: true,
      },
    },
  })
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
}
