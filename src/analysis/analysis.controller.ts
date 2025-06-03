import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpStatus,
  Req,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../users/enums/role.enum';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { AnalysisService } from './analysis.service';
import { CreateAnalyseDto } from './dto/create-analyse.dto';
import { UpdateAnalyseDto } from './dto/update-analyse.dto';
import { successResponse, errorResponse } from '../helper/response.helper';
import {
  ApiTags,
  ApiConsumes,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

@ApiTags('skin-analysis')
@Controller('analysis')
export class AnalysisController {
  private readonly logger = new Logger(AnalysisController.name);

  constructor(private readonly AnalysisService: AnalysisService) {
    // Ensure upload directory exists
    const uploadDir = './uploads/skin-analysis';
    if (!require('fs').existsSync(uploadDir)) {
      require('fs').mkdirSync(uploadDir, { recursive: true });
    }
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/skin-analysis',
        filename: (req, file, callback) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          const filename = `${uniqueSuffix}${ext}`;
          callback(null, filename);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
          return callback(new Error('Only image files are allowed!'), false);
        }
        callback(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  @ApiOperation({
    summary: 'Upload and analyze skin image',
    description:
      'Upload an image for AI-powered skin analysis. Returns skin type classification and product recommendations.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Skin image file for analysis',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image file (JPG, JPEG, PNG only, max 5MB)',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Skin analysis completed successfully',
    schema: {
      example: {
        message: 'Skin analysis completed successfully',
        data: {
          _id: '67741234567890abcdef1234',
          userId: '67741234567890abcdef5678',
          imageUrl:
            'http://localhost:3000/uploads/skin-analysis/1234567890-123456789.jpg',
          skinType: 'oily',
          result: 'Your skin type is oily with 87.5% confidence',
          analysisDate: '2025-01-06T10:30:00.000Z',
          recommendedProducts: [
            {
              recommendationId: 'rec-1-1704538200000',
              productId: '67741234567890abcdef9999',
              reason: 'Suitable for oily skin type - Gentle cleanser',
            },
            {
              recommendationId: 'rec-2-1704538200000',
              productId: '67741234567890abcdef8888',
              reason: 'Suitable for oily skin type - Oil-control moisturizer',
            },
          ],
          createdAt: '2025-01-06T10:30:00.000Z',
          updatedAt: '2025-01-06T10:30:00.000Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid file or missing file',
    schema: {
      example: {
        message: 'No image file provided',
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token required',
    schema: {
      example: {
        message: 'Unauthorized',
        statusCode: 401,
      },
    },
  })
  async uploadAndAnalyze(
    @UploadedFile() file: Express.Multer.File,
    @Req() req,
  ) {
    try {
      this.logger.log(
        `Received upload request. File: ${file ? 'present' : 'missing'}`,
      );

      if (!file) {
        this.logger.error('No file received in upload request');
        return errorResponse('No image file provided', HttpStatus.BAD_REQUEST);
      }

      this.logger.log(
        `File details: ${file.originalname}, size: ${file.size}, mimetype: ${file.mimetype}`,
      );

      const userId = req.user.userId || req.user._id || req.user.sub;
      const imageUrl = `${req.protocol}://${req.get('host')}/uploads/skin-analysis/${file.filename}`;

      // Read file buffer for analysis
      let fileBuffer: Buffer;
      if (file.buffer) {
        fileBuffer = file.buffer;
      } else if (file.path) {
        fileBuffer = await require('fs').promises.readFile(file.path);
      } else {
        throw new Error('No file buffer or path available');
      }

      this.logger.log(`Processing analysis for user: ${userId}`);

      const result = await this.AnalysisService.processAndSaveAnalysis(
        fileBuffer,
        userId,
        imageUrl,
      );

      this.logger.log(`Analysis completed successfully for user: ${userId}`);

      return successResponse(result, 'Skin analysis completed successfully');
    } catch (error) {
      this.logger.error(
        `Error during skin analysis: ${error.message}`,
        error.stack,
      );
      return errorResponse(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('user-analyses')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Get current user's analysis history",
    description:
      'Retrieve all skin analysis records for the authenticated user, sorted by most recent first.',
  })
  @ApiResponse({
    status: 200,
    description: 'User analyses retrieved successfully',
    schema: {
      example: {
        message: 'User analyses retrieved successfully',
        data: [
          {
            _id: '67741234567890abcdef1234',
            userId: '67741234567890abcdef5678',
            imageUrl:
              'http://localhost:3000/uploads/skin-analysis/1234567890-123456789.jpg',
            skinType: 'oily',
            result: 'Your skin type is oily with 87.5% confidence',
            analysisDate: '2025-01-06T10:30:00.000Z',
            recommendedProducts: [
              {
                recommendationId: 'rec-1-1704538200000',
                productId: '67741234567890abcdef9999',
                reason: 'Suitable for oily skin type - Gentle cleanser',
              },
            ],
            createdAt: '2025-01-06T10:30:00.000Z',
            updatedAt: '2025-01-06T10:30:00.000Z',
          },
        ],
      },
    },
  })
  async findUserAnalyses(@Req() req) {
    try {
      const userId = req.user.userId || req.user._id || req.user.sub;
      const analyses = await this.AnalysisService.findByUserId(userId);
      return successResponse(analyses, 'User analyses retrieved successfully');
    } catch (error) {
      this.logger.error(`Error fetching user analyses: ${error.message}`);
      return errorResponse(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get specific analysis by ID',
    description:
      'Retrieve detailed information about a specific skin analysis.',
  })
  @ApiResponse({
    status: 200,
    description: 'Analysis retrieved successfully',
    schema: {
      example: {
        message: 'Analysis retrieved successfully',
        data: {
          _id: '67741234567890abcdef1234',
          userId: '67741234567890abcdef5678',
          imageUrl:
            'http://localhost:3000/uploads/skin-analysis/1234567890-123456789.jpg',
          skinType: 'dry',
          result: 'Your skin type is dry with 92.3% confidence',
          analysisDate: '2025-01-06T10:30:00.000Z',
          recommendedProducts: [
            {
              recommendationId: 'rec-1-1704538200000',
              productId: '67741234567890abcdef9999',
              reason: 'Suitable for dry skin type - Hydrating cleanser',
            },
            {
              recommendationId: 'rec-2-1704538200000',
              productId: '67741234567890abcdef8888',
              reason: 'Suitable for dry skin type - Rich moisturizer',
            },
          ],
          createdAt: '2025-01-06T10:30:00.000Z',
          updatedAt: '2025-01-06T10:30:00.000Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Analysis not found',
    schema: {
      example: {
        message: 'Analysis with ID 67741234567890abcdef1234 not found',
        error: 'Not Found',
      },
    },
  })
  async findOne(@Param('id') id: string) {
    try {
      const analysis = await this.AnalysisService.findOne(id);
      return successResponse(analysis, 'Analysis retrieved successfully');
    } catch (error) {
      this.logger.error(`Error fetching analysis: ${error.message}`);
      return errorResponse(error.message, HttpStatus.NOT_FOUND);
    }
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update analysis (Admin only)',
    description:
      'Update an existing skin analysis. Only administrators can perform this action.',
  })
  @ApiBody({
    description: 'Analysis update data',
    schema: {
      example: {
        skinType: 'normal',
        result: 'Your skin type is normal with 95.1% confidence',
        recommendedProducts: [
          {
            recommendationId: 'rec-1-1704538200000',
            productId: '67741234567890abcdef9999',
            reason: 'Suitable for normal skin type - Balanced cleanser',
          },
        ],
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Analysis updated successfully',
    schema: {
      example: {
        message: 'Analysis updated successfully',
        data: {
          _id: '67741234567890abcdef1234',
          userId: '67741234567890abcdef5678',
          imageUrl:
            'http://localhost:3000/uploads/skin-analysis/1234567890-123456789.jpg',
          skinType: 'normal',
          result: 'Your skin type is normal with 95.1% confidence',
          analysisDate: '2025-01-06T10:30:00.000Z',
          recommendedProducts: [
            {
              recommendationId: 'rec-1-1704538200000',
              productId: '67741234567890abcdef9999',
              reason: 'Suitable for normal skin type - Balanced cleanser',
            },
          ],
          createdAt: '2025-01-06T10:30:00.000Z',
          updatedAt: '2025-01-06T10:35:00.000Z',
        },
      },
    },
  })
  async update(
    @Param('id') id: string,
    @Body() updateAnalyseDto: UpdateAnalyseDto,
  ) {
    try {
      const updatedAnalysis = await this.AnalysisService.update(
        id,
        updateAnalyseDto,
      );
      return successResponse(updatedAnalysis, 'Analysis updated successfully');
    } catch (error) {
      this.logger.error(`Error updating analysis: ${error.message}`);
      return errorResponse(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete analysis',
    description:
      'Delete a skin analysis. Users can only delete their own analyses, admins can delete any.',
  })
  @ApiResponse({
    status: 200,
    description: 'Analysis deleted successfully',
    schema: {
      example: {
        message: 'Analysis deleted successfully',
        data: {
          deleted: true,
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Can only delete own analyses',
    schema: {
      example: {
        message: 'You can only delete your own analyses',
        error: 'Forbidden',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Analysis not found',
    schema: {
      example: {
        message: 'Analysis with ID 67741234567890abcdef1234 not found',
        error: 'Not Found',
      },
    },
  })
  async remove(@Param('id') id: string, @Req() req) {
    try {
      const analysis = await this.AnalysisService.findOne(id);
      const userId = req.user.userId || req.user._id || req.user.sub;

      if (
        analysis.userId.toString() !== userId &&
        req.user.role !== Role.ADMIN
      ) {
        return errorResponse(
          'You can only delete your own analyses',
          HttpStatus.FORBIDDEN,
        );
      }

      const result = await this.AnalysisService.remove(id);
      return successResponse(result, 'Analysis deleted successfully');
    } catch (error) {
      this.logger.error(`Error deleting analysis: ${error.message}`);
      return errorResponse(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
