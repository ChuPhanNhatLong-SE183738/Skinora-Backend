import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { DoctorsService } from './doctors.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { WeeklyAvailability } from './utils/availability.util';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Role } from '../users/enums/role.enum';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('doctors')
@ApiBearerAuth()
@Controller('doctors')
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async create(@Body() createDoctorDto: CreateDoctorDto) {
    const doctor = await this.doctorsService.create(createDoctorDto);
    return {
      success: true,
      message: 'Doctor created successfully',
      data: doctor
    };
  }

  @Get()
  async findAll() {
    const doctors = await this.doctorsService.findAll();
    return {
      success: true,
      message: 'Doctors retrieved successfully',
      data: doctors
    };
  }

  @Get(':id')
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
