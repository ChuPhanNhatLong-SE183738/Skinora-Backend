import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Res,
  HttpStatus,
  Get,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { successResponse, errorResponse } from '../helper/response.helper';
import { LoginUserDto } from '../users/dto/login-user.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private authService: AuthService) {}

  @ApiOperation({
    summary: 'Login user',
    description:
      'Authenticate user with email and password. Returns JWT token and user information.',
  })
  @ApiBody({
    description: 'User login credentials',
    type: LoginUserDto,
    examples: {
      example1: {
        summary: 'Standard user login',
        value: {
          email: 'user@example.com',
          password: 'password123',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    schema: {
      example: {
        message: 'Login successful',
        user: {
          id: '67741234567890abcdef5678',
          email: 'user@example.com',
          fullName: 'John Doe',
          phone: '+84901234567',
          address: '123 Main St, Ho Chi Minh City',
          dob: '1990-01-15T00:00:00.000Z',
          avatarUrl: 'https://example.com/avatar.jpg',
          role: 'user',
          isActive: true,
          isVerified: true,
        },
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid credentials',
    schema: {
      example: {
        message: 'Invalid credentials',
        statusCode: 401,
      },
    },
  })
  @UseGuards(AuthGuard('local'))
  @Post('login')
  async login(@Request() req, @Res() response: Response) {
    const result = await this.authService.login(req.user, response);
    return response.json(result);
  }

  @ApiOperation({
    summary: 'Register new user',
    description: 'Create a new user account with the provided information.',
  })
  @ApiBody({
    description: 'User registration data',
    type: CreateUserDto,
    examples: {
      example1: {
        summary: 'New user registration',
        value: {
          email: 'newuser@example.com',
          password: 'securePassword123',
          fullName: 'Jane Smith',
          phone: '+84901234568',
          dob: '1995-03-20',
          address: '456 Secondary St, Hanoi',
          avatarUrl: 'https://example.com/jane-avatar.jpg',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'User successfully created',
    schema: {
      example: {
        message: 'Registration successful',
        user: {
          id: '67741234567890abcdef9999',
          email: 'newuser@example.com',
          fullName: 'Jane Smith',
          phone: '+84901234568',
          address: '456 Secondary St, Hanoi',
          dob: '1995-03-20T00:00:00.000Z',
          avatarUrl: 'https://example.com/jane-avatar.jpg',
          role: 'user',
          isActive: true,
          isVerified: false,
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Validation errors or user already exists',
    schema: {
      example: {
        message: [
          'email must be a valid email address',
          'password must be at least 6 characters long',
        ],
        error: 'Bad Request',
        statusCode: 400,
      },
    },
  })
  @Post('register')
  async register(
    @Body() createUserDto: CreateUserDto,
    @Res() response: Response,
  ) {
    const result = await this.authService.register(createUserDto, response);
    return response.json(result);
  }

  @Get('verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Verify JWT token',
    description:
      'Validate the provided JWT token and return user information if valid.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token is valid',
    schema: {
      example: {
        message: 'Token is valid',
        data: {
          valid: true,
          user: {
            email: 'user@example.com',
            sub: '67741234567890abcdef5678',
            userId: '67741234567890abcdef5678',
            role: 'user',
            iat: 1704538200,
            exp: 1704624600,
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
    schema: {
      example: {
        message: 'Unauthorized',
        statusCode: 401,
      },
    },
  })
  async verifyToken(@Request() req) {
    try {
      return successResponse(
        {
          valid: true,
          user: req.user,
        },
        'Token is valid',
      );
    } catch (error) {
      return errorResponse(error.message, HttpStatus.UNAUTHORIZED);
    }
  }

  @Get('my-profile')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get current user profile',
    description:
      'Retrieve detailed profile information for the authenticated user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns user profile',
    schema: {
      example: {
        id: '67741234567890abcdef5678',
        email: 'user@example.com',
        fullName: 'John Doe',
        role: 'user',
        phone: '+84901234567',
        address: '123 Main St, Ho Chi Minh City',
        dob: '1990-01-15T00:00:00.000Z',
        avatarUrl: 'https://example.com/avatar.jpg',
        isActive: true,
        isVerified: true,
        skinAnalysisHistory: [
          {
            _id: '67741234567890abcdef1111',
            skinType: 'oily',
            analysisDate: '2025-01-06T10:30:00.000Z',
          },
        ],
        purchaseHistory: [],
        createdAt: '2024-12-01T08:00:00.000Z',
        updatedAt: '2025-01-06T10:30:00.000Z',
      },
    },
  })
  @ApiBearerAuth()
  async getMyProfile(@Request() req) {
    const userId = req.user.sub || req.user.id;
    return this.authService.getMyProfile(userId);
  }

  @Get('debug-token')
  @UseGuards(JwtAuthGuard)
  async debugToken(@Request() req) {
    return {
      user: req.user,
      message: 'This is what your token contains',
    };
  }
}
