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
} from '@nestjs/common';
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
} from '@nestjs/swagger';
import { DoctorLoginDto } from './dto/doctor-login.dto';

@ApiTags('doctors')
@Controller('doctors')
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Post('auth/login')
  @ApiOperation({ summary: 'Doctor login' })
  @ApiResponse({
    status: 200,
    description: 'Doctor logged in successfully',
    schema: {
      example: {
        success: true,
        message: 'Doctor logged in successfully',
        data: {
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          doctor: {
            _id: '675...',
            fullName: 'Dr. John Smith',
            email: 'doctor@skinora.com',
            specializations: ['Dermatology'],
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
  async create(@Body() createDoctorDto: CreateDoctorDto) {
    const doctor = await this.doctorsService.create(createDoctorDto);
    return {
      success: true,
      message: 'Doctor created successfully',
      data: doctor,
    };
  }

  @Get()
  async findAll() {
    const doctors = await this.doctorsService.findAll();
    return {
      success: true,
      message: 'Doctors retrieved successfully',
      data: doctors,
    };
  }

  @Get(':id')
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

  @Get('auth/profile')
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

  @Patch('auth/profile')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update doctor profile (authenticated)' })
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
}
