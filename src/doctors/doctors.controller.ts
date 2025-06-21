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
  UseInterceptors,
  UploadedFile,
  Logger,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { DoctorsService } from './doctors.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { WeeklyAvailability } from './utils/availability.util';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Role } from '../users/enums/role.enum';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiConsumes,
  ApiQuery
} from '@nestjs/swagger';
import { DoctorLoginDto } from './dto/doctor-login.dto';
import { successResponse, errorResponse } from '../helper/response.helper';

@ApiTags('doctors')
@Controller('doctors')
export class DoctorsController {
  private readonly logger = new Logger(DoctorsController.name);

  constructor(private readonly doctorsService: DoctorsService) {
    // Ensure upload directory exists
    const uploadDir = './uploads/doctors';
    if (!require('fs').existsSync(uploadDir)) {
      require('fs').mkdirSync(uploadDir, { recursive: true });
    }
  }

  @Post('auth/login')
  @ApiOperation({ summary: 'Doctor login' })
  @ApiResponse({
    status: 200,
    description: 'Doctor logged in successfully',
    schema: {
      example: {
        success: true, message: 'Doctor logged in successfully',
        data: {
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          doctor: {
            _id: '675...',
            fullName: 'Dr. John Smith',
            email: 'doctor@skinora.com',
            specializations: ['Dermatology'],
            experience: 8,
            rating: 4.8,
          },
          tokenType: 'Bearer',
          expiresIn: '7d',
        },
      },
    },
  })
  async loginDoctor(@Body() loginDto: DoctorLoginDto) {
    try {
      const result = await this.doctorsService.loginAsDoctor(
        loginDto.email,
        loginDto.password,
      );
      return {
        success: true,
        message: 'Doctor logged in successfully',
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a doctor account (Admin only)' })
  @ApiBody({
    type: CreateDoctorDto,
    description: 'Doctor account creation data',
    examples: {
      example1: {
        summary: 'Basic doctor account', value: {
          email: "doctor@example.com",
          password: "password123",
          fullName: "Dr. John Smith",
          phone: "+84912345678",
          experience: 5,
          specializations: ["6459ab2dfc13ae7a0b000001"]
        }
      },
      example2: {
        summary: 'Complete doctor profile', value: {
          email: "specialist@example.com",
          password: "securePass123",
          fullName: "Dr. Emily Johnson",
          phone: "+84987654321",
          dob: "1985-06-15",
          address: "123 Medical Street, Hanoi",
          experience: 12,
          specializations: ["6459ab2dfc13ae7a0b000001", "6459ab2dfc13ae7a0b000002"],
          photoUrl: "https://example.com/doctor-photo.jpg",
          availability: {
            monday: {
              isAvailable: true,
              timeRanges: [{ start: "09:00", end: "12:00" }, { start: "14:00", end: "17:00" }],
              timeSlots: ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"]
            },
            tuesday: {
              isAvailable: true,
              timeRanges: [{ start: "09:00", end: "17:00" }],
              timeSlots: ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"]
            },
            wednesday: {
              isAvailable: true,
              timeRanges: [{ start: "09:00", end: "17:00" }],
              timeSlots: ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"]
            },
            thursday: {
              isAvailable: true,
              timeRanges: [{ start: "09:00", end: "17:00" }],
              timeSlots: ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"]
            },
            friday: {
              isAvailable: true,
              timeRanges: [{ start: "09:00", end: "17:00" }],
              timeSlots: ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"]
            },
            saturday: {
              isAvailable: false,
              timeRanges: [],
              timeSlots: []
            },
            sunday: {
              isAvailable: false,
              timeRanges: [],
              timeSlots: []
            }
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 201,
    description: 'Doctor created successfully',
    schema: {
      example: {
        success: true,
        message: 'Doctor created successfully',
        data: {
          _id: '6459ab2dfc13ae7a0b000003',
          email: 'doctor@example.com',
          fullName: 'Dr. John Smith',
          phone: '+84912345678',
          experience: 5,
          specializations: ['6459ab2dfc13ae7a0b000001'],
          isActive: true,
          isVerified: false,
          createdAt: '2023-06-15T09:00:00.000Z',
          updatedAt: '2023-06-15T09:00:00.000Z'
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid data provided' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not an admin' })
  async create(@Body() createDoctorDto: CreateDoctorDto) {
    const doctor = await this.doctorsService.create(createDoctorDto);
    return {
      success: true,
      message: 'Doctor created successfully',
      data: doctor,
    };
  }
  @Get()
  @ApiOperation({ 
    summary: 'Get all doctors with optional filtering',
    description: 'Retrieve all doctors with optional filters for active status, name, email, and verification status'
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: Boolean,
    description: 'Filter by active status (true for active doctors, false for inactive)',
    example: true
  })
  @ApiQuery({
    name: 'verified',
    required: false,
    type: Boolean,
    description: 'Filter by verification status (true for verified doctors, false for unverified)',
    example: true
  })
  @ApiQuery({
    name: 'name',
    required: false,
    type: String,
    description: 'Filter by doctor name (case-insensitive partial match)',
    example: 'John'
  })
  @ApiQuery({
    name: 'email',
    required: false,
    type: String,
    description: 'Filter by doctor email (case-insensitive partial match)',
    example: 'doctor@example.com'
  })
  @ApiResponse({
    status: 200,
    description: 'Doctors retrieved successfully',
    schema: {
      example: {
        success: true,
        message: 'Doctors retrieved successfully',
        data: [
          {
            _id: '6459ab2dfc13ae7a0b000003',
            email: 'doctor@example.com',
            fullName: 'Dr. John Smith',
            phone: '+84912345678',
            photoUrl: 'https://example.com/doctor-photo.jpg',
            experience: 8,
            specializations: [
              {
                _id: '6459ab2dfc13ae7a0b000001',
                name: 'Dermatology',
                description: 'Skin specialists'
              }
            ],
            isActive: true,
            isVerified: true,
            createdAt: '2025-06-21T10:00:00.000Z',
            updatedAt: '2025-06-21T14:30:00.000Z'
          }
        ],
        filters: {
          isActive: true,
          verified: true,
          name: 'John',
          email: 'doctor@example.com'
        },
        total: 1
      }
    }
  })
  async findAll(
    @Query('isActive') isActive?: string,
    @Query('verified') verified?: string,
    @Query('name') name?: string,
    @Query('email') email?: string,
  ) {
    // Parse boolean query parameters
    const filters: any = {};
    
    if (isActive !== undefined) {
      filters.isActive = isActive === 'true';
    }
    
    if (verified !== undefined) {
      filters.verified = verified === 'true';
    }
    
    if (name) {
      filters.name = name.trim();
    }
    
    if (email) {
      filters.email = email.trim();
    }

    const doctors = await this.doctorsService.findAll(Object.keys(filters).length > 0 ? filters : undefined);
    
    return {
      success: true,
      message: 'Doctors retrieved successfully',
      data: doctors,
      filters: Object.keys(filters).length > 0 ? filters : null,
      total: doctors.length,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get doctor by ID' })
  @ApiParam({ name: 'id', description: 'Doctor ID', example: '6459ab2dfc13ae7a0b000003' })
  @ApiResponse({
    status: 200,
    description: 'Doctor retrieved successfully',
    schema: {
      example: {
        success: true,
        message: 'Doctor retrieved successfully',
        data: {
          _id: '6459ab2dfc13ae7a0b000003', email: 'doctor@example.com',
          fullName: 'Dr. John Smith',
          phone: '+84912345678',
          photoUrl: 'https://example.com/doctor-photo.jpg',
          experience: 10,
          specializations: [
            {
              _id: '6459ab2dfc13ae7a0b000001',
              name: 'Dermatology',
              description: 'Skin specialists'
            }
          ],
          availability: {
            monday: {
              isAvailable: true,
              timeRanges: [{ start: "09:00", end: "17:00" }],
              timeSlots: ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"]
            },
            // ... other days
          },
          isActive: true,
          isVerified: true
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid ID format' })
  @ApiResponse({ status: 404, description: 'Not found - Doctor does not exist' })
  async findOne(@Param('id') id: string) {
    const doctor = await this.doctorsService.findOne(id);
    return {
      success: true,
      message: 'Doctor retrieved successfully',
      data: doctor,
    };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.DOCTOR)
  @ApiOperation({ summary: 'Update doctor information (Admin or Doctor)' })
  @ApiParam({ name: 'id', description: 'Doctor ID', example: '6459ab2dfc13ae7a0b000003' })
  @ApiBody({
    type: UpdateDoctorDto,
    description: 'Doctor update data',
    examples: {
      example1: {
        summary: 'Update basic information',
        value: {
          fullName: "Dr. John Smith Jr.",
          phone: "+84912345679",
          address: "456 Medical Center, Ho Chi Minh City"
        }
      }, example2: {
        summary: 'Update specializations',
        value: {
          specializations: ["6459ab2dfc13ae7a0b000001", "6459ab2dfc13ae7a0b000002"]
        }
      },
      example3: {
        summary: 'Update experience',
        value: {
          experience: 15
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Doctor updated successfully',
    schema: {
      example: {
        success: true,
        message: 'Doctor updated successfully',
        data: {
          _id: '6459ab2dfc13ae7a0b000003',
          fullName: 'Dr. John Smith Jr.',
          phone: '+84912345679',
          address: '456 Medical Center, Ho Chi Minh City',
          experience: 12
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not an admin or the doctor themselves' })
  @ApiResponse({ status: 404, description: 'Not found - Doctor does not exist' })
  async update(
    @Param('id') id: string,
    @Body() updateDoctorDto: UpdateDoctorDto,
  ) {
    const doctor = await this.doctorsService.update(id, updateDoctorDto);
    return {
      success: true,
      message: 'Doctor updated successfully',
      data: doctor,
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete a doctor (Admin only)' })
  @ApiParam({ name: 'id', description: 'Doctor ID', example: '6459ab2dfc13ae7a0b000003' })
  @ApiResponse({
    status: 200,
    description: 'Doctor deleted successfully',
    schema: {
      example: {
        success: true,
        message: 'Doctor deleted successfully',
        data: { deleted: true }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid ID format' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not an admin' })
  @ApiResponse({ status: 404, description: 'Not found - Doctor does not exist' })
  async remove(@Param('id') id: string) {
    const result = await this.doctorsService.remove(id);
    return {
      success: true,
      message: 'Doctor deleted successfully',
      data: result,
    };
  }

  @Patch(':id/availability')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.DOCTOR)
  @ApiOperation({ summary: 'Update doctor availability schedule (Admin or Doctor)' })
  @ApiParam({ name: 'id', description: 'Doctor ID', example: '6459ab2dfc13ae7a0b000003' })
  @ApiBody({
    description: 'Doctor availability data',
    schema: {
      type: 'object',
      example: {
        monday: {
          isAvailable: true,
          timeRanges: [{ start: "09:00", end: "12:00" }, { start: "14:00", end: "17:00" }],
          timeSlots: ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"]
        },
        tuesday: {
          isAvailable: true,
          timeRanges: [{ start: "09:00", end: "17:00" }],
          timeSlots: ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"]
        },
        // ... other days
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Doctor availability updated successfully',
    schema: {
      example: {
        success: true,
        message: 'Doctor availability updated successfully',
        data: {
          _id: '6459ab2dfc13ae7a0b000003',
          fullName: 'Dr. John Smith',
          availability: {
            monday: {
              isAvailable: true,
              timeRanges: [{ start: "09:00", end: "12:00" }, { start: "14:00", end: "17:00" }],
              timeSlots: ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"]
            },
            // ... other days
          }
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not an admin or the doctor' })
  @ApiResponse({ status: 404, description: 'Not found - Doctor does not exist' })
  async updateAvailability(
    @Param('id') id: string,
    @Body() availability: WeeklyAvailability,
  ) {
    const doctor = await this.doctorsService.updateAvailability(
      id,
      availability,
    );
    return {
      success: true,
      message: 'Doctor availability updated successfully',
      data: doctor,
    };
  }

  @Get('profile')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get doctor profile (authenticated)' })
  async getDoctorProfile(@Request() req) {
    try {
      console.log('Doctor profile request user:', req.user);

      const doctorId = req.user.sub || req.user.doctorId;

      if (!doctorId) {
        return {
          success: false,
          message: 'Doctor ID not found in token',
        };
      }

      const doctor = await this.doctorsService.getDoctorProfile(doctorId);
      return {
        success: true,
        message: 'Doctor profile retrieved successfully',
        data: doctor,
      };
    } catch (error) {
      console.error('Get doctor profile error:', error);
      return {
        success: false,
        message: error.message,
      };
    }
  }
  @Patch('profile')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Update doctor profile (authenticated)',
    description: 'Allows an authenticated doctor to update their own profile information'
  })
  @ApiBody({
    type: UpdateDoctorDto,
    description: 'Profile data to update',
    examples: {
      basic: {
        summary: 'Update basic info',
        value: {
          fullName: 'Dr. John Smith Jr.',
          phone: '+84987654321'
        }
      },
      experience: {
        summary: 'Update experience',
        value: {
          experience: 12
        }
      },
      complete: {
        summary: 'Update multiple fields',
        value: {
          fullName: 'Dr. Emily Johnson',
          phone: '+84912345678',
          address: '456 Medical Street, Ho Chi Minh City',
          experience: 15,
          photoUrl: 'https://example.com/new-photo.jpg'
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Doctor profile updated successfully',
    schema: {
      example: {
        success: true,
        message: 'Doctor profile updated successfully',
        data: {
          _id: '675a8b4c12345678901234ab',
          fullName: 'Dr. Emily Johnson',
          email: 'doctor@skinora.com',
          phone: '+84912345678',
          address: '456 Medical Street, Ho Chi Minh City',
          experience: 15,
          photoUrl: 'https://example.com/new-photo.jpg',
          specializations: ['Dermatology'],
          isActive: true,
          isVerified: true,
          updatedAt: '2025-06-21T14:30:00.000Z'
        }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid data',
    schema: {
      example: {
        success: false,
        message: 'Validation failed'
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Doctor not found',
    schema: {
      example: {
        success: false,
        message: 'Doctor not found'
      }
    }
  })
  async updateDoctorProfile(
    @Request() req,
    @Body() updateData: UpdateDoctorDto,
  ) {
    try {
      const doctorId = req.user.sub || req.user.doctorId;
      const doctor = await this.doctorsService.updateDoctorProfile(
        doctorId,
        updateData,
      );
      return {
        success: true,
        message: 'Doctor profile updated successfully',
        data: doctor,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @Patch('photo')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Update doctor photo URL (authenticated)',
    description: 'Allows an authenticated doctor to update their profile photo URL'
  })
  @ApiBody({
    description: 'Photo URL to update',
    schema: {
      type: 'object',
      properties: {
        photoUrl: {
          type: 'string',
          description: 'Valid URL for the doctor\'s profile photo',
          example: 'https://example.com/photos/doctor-profile.jpg'
        }
      },
      required: ['photoUrl']
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Doctor photo updated successfully',
    schema: {
      example: {
        success: true,
        message: 'Doctor photo updated successfully',
        data: {
          _id: '675a8b4c12345678901234ab',
          fullName: 'Dr. John Smith',
          email: 'doctor@skinora.com',
          photoUrl: 'https://example.com/photos/doctor-profile.jpg',
          specializations: ['Dermatology'],
          experience: 5,
          updatedAt: '2025-06-21T14:30:00.000Z'
        }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid photo URL or doctor ID',
    schema: {
      example: {
        success: false,
        message: 'Invalid photo URL format'
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Doctor not found',
    schema: {
      example: {
        success: false,
        message: 'Doctor not found'
      }
    }
  })
  async updateDoctorPhoto(
    @Request() req,
    @Body('photoUrl') photoUrl: string,
  ) {
    try {
      const doctorId = req.user.sub || req.user.doctorId;
      const result = await this.doctorsService.updateDoctorPhoto(doctorId, photoUrl);
      return result;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @Post('upload-photo')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: diskStorage({
        destination: './uploads/doctors',
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          callback(null, `doctor-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif)$/)) {
          return callback(new Error('Only image files (jpg, jpeg, png, gif) are allowed!'), false);
        }
        callback(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
      },
    })
  )
  @ApiOperation({
    summary: 'Upload doctor profile photo (authenticated)',
    description: 'Allows an authenticated doctor to upload a new profile photo directly'
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Photo file to upload',
    schema: {
      type: 'object',
      properties: {
        photo: {
          type: 'string',
          format: 'binary',
          description: 'Profile photo file (jpg, jpeg, png, gif, max 5MB)'
        }
      },
      required: ['photo']
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Doctor photo uploaded and updated successfully',
    schema: {
      example: {
        success: true,
        message: 'Doctor photo uploaded successfully',
        data: {
          _id: '675a8b4c12345678901234ab',
          fullName: 'Dr. John Smith',
          email: 'doctor@skinora.com',
          photoUrl: 'http://localhost:3000/uploads/doctors/doctor-1640995200000-123456789.jpg',
          specializations: ['Dermatology'],
          experience: 5,
          updatedAt: '2025-06-21T14:30:00.000Z'
        }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid file type or size',
    schema: {
      example: {
        success: false,
        message: 'Only image files (jpg, jpeg, png, gif) are allowed!'
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Doctor not found',
    schema: {
      example: {
        success: false,
        message: 'Doctor not found'
      }
    }
  })
  async uploadDoctorPhoto(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
  ) {
    try {
      this.logger.log(`Received photo upload request. File: ${file ? 'present' : 'missing'}`);

      if (!file) {
        this.logger.error('No file received in upload request');
        return errorResponse('No photo file provided', HttpStatus.BAD_REQUEST);
      }

      this.logger.log(`File details: ${file.originalname}, size: ${file.size}, mimetype: ${file.mimetype}`);

      const doctorId = req.user.sub || req.user.doctorId;

      // Construct the photo URL
      const photoUrl = `${req.protocol}://${req.get('host')}/uploads/doctors/${file.filename}`;

      this.logger.log(`Updating doctor photo for doctor: ${doctorId} with URL: ${photoUrl}`);

      const result = await this.doctorsService.updateDoctorPhoto(doctorId, photoUrl);

      this.logger.log(`Doctor photo uploaded successfully for doctor: ${doctorId}`);

      return successResponse(
        result.data,
        'Doctor photo uploaded successfully'
      );
    } catch (error) {
      this.logger.error(`Error during photo upload: ${error.message}`, error.stack);
      return errorResponse(error.message, error.status || HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Patch(':id/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Deactivate a doctor account (Admin only)',
    description: 'Deactivates a doctor account, preventing them from logging in and being visible to patients'
  })
  @ApiParam({
    name: 'id',
    description: 'Doctor ID to deactivate',
    example: '675a8b4c12345678901234ab'
  })
  @ApiResponse({
    status: 200,
    description: 'Doctor account deactivated successfully',
    schema: {
      example: {
        success: true,
        message: 'Doctor account deactivated successfully',
        data: {
          _id: '675a8b4c12345678901234ab',
          fullName: 'Dr. John Smith',
          email: 'doctor@skinora.com',
          phone: '+84912345678',
          experience: 8,
          specializations: ['Dermatology'],
          isActive: false,
          isVerified: true,
          updatedAt: '2025-06-21T14:30:00.000Z'
        }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid doctor ID',
    schema: {
      example: {
        success: false,
        message: 'Invalid doctor ID'
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid token',
    schema: {
      example: {
        success: false,
        message: 'Unauthorized'
      }
    }
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
    schema: {
      example: {
        success: false,
        message: 'Forbidden'
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Doctor not found',
    schema: {
      example: {
        success: false,
        message: 'Doctor not found'
      }
    }
  })
  async deactivateDoctor(@Param('id') id: string) {
    try {
      const result = await this.doctorsService.deactivateDoctor(id);
      return result;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @Patch(':id/reactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Reactivate a doctor account (Admin only)',
    description: 'Reactivates a previously deactivated doctor account, allowing them to login and be visible to patients'
  })
  @ApiParam({
    name: 'id',
    description: 'Doctor ID to reactivate',
    example: '675a8b4c12345678901234ab'
  })
  @ApiResponse({
    status: 200,
    description: 'Doctor account reactivated successfully',
    schema: {
      example: {
        success: true,
        message: 'Doctor account reactivated successfully',
        data: {
          _id: '675a8b4c12345678901234ab',
          fullName: 'Dr. John Smith',
          email: 'doctor@skinora.com',
          phone: '+84912345678',
          experience: 8,
          specializations: ['Dermatology'],
          isActive: true,
          isVerified: true,
          updatedAt: '2025-06-21T14:30:00.000Z'
        }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid doctor ID',
    schema: {
      example: {
        success: false,
        message: 'Invalid doctor ID'
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid token',
    schema: {
      example: {
        success: false,
        message: 'Unauthorized'
      }
    }
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
    schema: {
      example: {
        success: false,
        message: 'Forbidden'
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Doctor not found',
    schema: {
      example: {
        success: false,
        message: 'Doctor not found'
      }
    }
  })
  async reactivateDoctor(@Param('id') id: string) {
    try {
      const result = await this.doctorsService.reactivateDoctor(id);
      return result;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
