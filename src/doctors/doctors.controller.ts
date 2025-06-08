import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
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
  ApiBody 
} from '@nestjs/swagger';

@ApiTags('doctors')
@ApiBearerAuth()
@Controller('doctors')
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a doctor account (Admin only)' })
  @ApiBody({ 
    type: CreateDoctorDto, 
    description: 'Doctor account creation data',
    examples: {
      example1: {
        summary: 'Basic doctor account',
        value: {
          email: "doctor@example.com",
          password: "password123",
          fullName: "Dr. John Smith",
          phone: "+84912345678",
          specializations: ["6459ab2dfc13ae7a0b000001"]
        }
      },
      example2: {
        summary: 'Complete doctor profile',
        value: {
          email: "specialist@example.com",
          password: "securePass123",
          fullName: "Dr. Emily Johnson",
          phone: "+84987654321",
          dob: "1985-06-15",
          address: "123 Medical Street, Hanoi",
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
      data: doctor
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all active doctors' })
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
            specializations: [
              {
                _id: '6459ab2dfc13ae7a0b000001',
                name: 'Dermatology',
                description: 'Skin specialists'
              }
            ],
            isActive: true,
            isVerified: true
          }
        ]
      }
    }
  })
  async findAll() {
    const doctors = await this.doctorsService.findAll();
    return {
      success: true,
      message: 'Doctors retrieved successfully',
      data: doctors
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
          _id: '6459ab2dfc13ae7a0b000003',
          email: 'doctor@example.com',
          fullName: 'Dr. John Smith',
          phone: '+84912345678',
          photoUrl: 'https://example.com/doctor-photo.jpg',
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
      data: doctor
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
      },
      example2: {
        summary: 'Update specializations',
        value: {
          specializations: ["6459ab2dfc13ae7a0b000001", "6459ab2dfc13ae7a0b000002"]
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
          // ... other fields
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not an admin or the doctor themselves' })
  @ApiResponse({ status: 404, description: 'Not found - Doctor does not exist' })
  async update(@Param('id') id: string, @Body() updateDoctorDto: UpdateDoctorDto) {
    const doctor = await this.doctorsService.update(id, updateDoctorDto);
    return {
      success: true,
      message: 'Doctor updated successfully',
      data: doctor
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
      data: result
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
    const doctor = await this.doctorsService.updateAvailability(id, availability);
    return {
      success: true,
      message: 'Doctor availability updated successfully',
      data: doctor
    };
  }
}
