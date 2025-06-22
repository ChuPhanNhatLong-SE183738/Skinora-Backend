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
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({
    summary: 'Create new user',
    description:
      'Create a new user account (Admin function - use /auth/register for public registration)',
  })
  @ApiBody({
    description: 'User creation data',
    type: CreateUserDto,
    examples: {
      example1: {
        summary: 'Create admin user',
        value: {
          email: 'admin@skinora.com',
          password: 'adminPassword123',
          fullName: 'Admin User',
          phone: '+84901111111',
          dob: '1985-01-01',
          address: 'Skinora HQ, Ho Chi Minh City',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
    schema: {
      example: {
        _id: '67741234567890abcdef7777',
        email: 'admin@skinora.com',
        fullName: 'Admin User',
        phone: '+84901111111',
        address: 'Skinora HQ, Ho Chi Minh City',
        dob: '1985-01-01T00:00:00.000Z',
        role: 'user',
        isActive: true,
        isVerified: false,
        skinAnalysisHistory: [],
        purchaseHistory: [],
        createdAt: '2025-01-06T11:00:00.000Z',
        updatedAt: '2025-01-06T11:00:00.000Z',
      },
    },
  })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all users with optional filtering',
    description: 'Retrieve all users with optional filters for active status, name, email, and verification status'
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: Boolean,
    description: 'Filter by active status (true for active users, false for inactive)',
    example: true
  })
  @ApiQuery({
    name: 'verified',
    required: false,
    type: Boolean,
    description: 'Filter by verification status (true for verified users, false for unverified)',
    example: true
  })
  @ApiQuery({
    name: 'name',
    required: false,
    type: String,
    description: 'Filter by user name (case-insensitive partial match)',
    example: 'John'
  })
  @ApiQuery({
    name: 'email',
    required: false,
    type: String,
    description: 'Filter by user email (case-insensitive partial match)',
    example: 'user@example.com'
  })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
    schema: {
      example: [
        {
          _id: '67741234567890abcdef5678',
          email: 'user1@example.com',
          fullName: 'John Doe',
          phone: '+84901234567',
          address: '123 Main St, Ho Chi Minh City',
          dob: '1990-01-15T00:00:00.000Z',
          role: 'user',
          isActive: true,
          isVerified: true,
          createdAt: '2024-12-01T08:00:00.000Z',
          updatedAt: '2025-01-06T10:30:00.000Z',
        },
        {
          _id: '67741234567890abcdef9999',
          email: 'user2@example.com',
          fullName: 'Jane Smith',
          phone: '+84901234568',
          address: '456 Secondary St, Hanoi',
          dob: '1995-03-20T00:00:00.000Z',
          role: 'user',
          isActive: true,
          isVerified: false,
          createdAt: '2024-12-15T10:00:00.000Z',
          updatedAt: '2024-12-15T10:00:00.000Z',
        },
      ],
    },
  })
  findAll(@Query() query: any) {
    // Convert string boolean values to actual booleans
    const filters: any = {};
    
    if (query.isActive !== undefined) {
      filters.isActive = query.isActive === 'true';
    }
    
    if (query.verified !== undefined) {
      filters.verified = query.verified === 'true';
    }
    
    if (query.name) {
      filters.name = query.name;
    }
    
    if (query.email) {
      filters.email = query.email;
    }

    return this.usersService.findAll(Object.keys(filters).length > 0 ? filters : undefined);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get user by ID',
    description: 'Retrieve detailed information about a specific user',
  })
  @ApiParam({
    name: 'id',
    description: 'MongoDB ObjectId of the user',
    example: '67741234567890abcdef5678',
  })
  @ApiResponse({
    status: 200,
    description: 'User found and returned successfully',
    schema: {
      example: {
        _id: '67741234567890abcdef5678',
        email: 'user@example.com',
        fullName: 'John Doe',
        phone: '+84901234567',
        address: '123 Main St, Ho Chi Minh City',
        dob: '1990-01-15T00:00:00.000Z',
        avatarUrl: 'https://example.com/avatar.jpg',
        role: 'user',
        isActive: true,
        isVerified: true,
        skinAnalysisHistory: [],
        purchaseHistory: [],
        createdAt: '2024-12-01T08:00:00.000Z',
        updatedAt: '2025-01-06T10:30:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
    schema: {
      example: {
        message: 'User not found',
        statusCode: 404,
      },
    },
  })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update user',
    description: 'Update user information by ID',
  })
  @ApiParam({
    name: 'id',
    description: 'MongoDB ObjectId of the user to update',
    example: '67741234567890abcdef5678',
  })
  @ApiBody({
    description: 'User update data (all fields optional)',
    type: UpdateUserDto,
    examples: {
      example1: {
        summary: 'Update user profile',
        value: {
          fullName: 'John Updated Doe',
          phone: '+84907777777',
          address: '789 New Address, Ho Chi Minh City',
          avatarUrl: 'https://example.com/new-avatar.jpg',
        },
      },
      example2: {
        summary: 'Update user status',
        value: {
          isActive: false,
          isVerified: true,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    schema: {
      example: {
        _id: '67741234567890abcdef5678',
        email: 'user@example.com',
        fullName: 'John Updated Doe',
        phone: '+84907777777',
        address: '789 New Address, Ho Chi Minh City',
        dob: '1990-01-15T00:00:00.000Z',
        avatarUrl: 'https://example.com/new-avatar.jpg',
        role: 'user',
        isActive: true,
        isVerified: true,
        updatedAt: '2025-01-06T11:30:00.000Z',
      },
    },
  })
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete user',
    description: 'Permanently delete a user account',
  })
  @ApiParam({
    name: 'id',
    description: 'MongoDB ObjectId of the user to delete',
    example: '67741234567890abcdef5678',
  })
  @ApiResponse({
    status: 200,
    description: 'User deleted successfully',
    schema: {
      example: {
        message: 'User deleted successfully',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
    schema: {
      example: {
        message: 'User not found',
        statusCode: 404,
      },
    },
  })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  @Patch(':id/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Verify user account',
    description: 'Mark a user account as verified',
  })
  @ApiParam({
    name: 'id',
    description: 'MongoDB ObjectId of the user to verify',
    example: '67741234567890abcdef5678',
  })
  @ApiResponse({
    status: 200,
    description: 'User verified successfully',
    schema: {
      example: {
        _id: '67741234567890abcdef5678',
        email: 'user@example.com',
        fullName: 'John Doe',
        isVerified: true,
        updatedAt: '2025-01-06T11:45:00.000Z',
      },
    },
  })
  verifyUser(@Param('id') id: string) {
    return this.usersService.verifyUser(id);
  }

  @Patch(':id/deactivate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Deactivate user account',
    description:
      'Deactivate a user account (user cannot login but data is preserved)',
  })
  @ApiParam({
    name: 'id',
    description: 'MongoDB ObjectId of the user to deactivate',
    example: '67741234567890abcdef5678',
  })
  @ApiResponse({
    status: 200,
    description: 'User deactivated successfully',
    schema: {
      example: {
        _id: '67741234567890abcdef5678',
        email: 'user@example.com',
        fullName: 'John Doe',
        isActive: false,
        updatedAt: '2025-01-06T11:50:00.000Z',
      },
    },
  })
  deactivateUser(@Param('id') id: string) {
    return this.usersService.deactivateUser(id);
  }

  @Patch(':id/activate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Activate user account',
    description: 'Reactivate a previously deactivated user account',
  })
  @ApiParam({
    name: 'id',
    description: 'MongoDB ObjectId of the user to activate',
    example: '67741234567890abcdef5678',
  })
  @ApiResponse({
    status: 200,
    description: 'User activated successfully',
    schema: {
      example: {
        _id: '67741234567890abcdef5678',
        email: 'user@example.com',
        fullName: 'John Doe',
        isActive: true,
        updatedAt: '2025-01-06T11:55:00.000Z',
      },
    },
  })
  activateUser(@Param('id') id: string) {
    return this.usersService.activateUser(id);
  }
}
