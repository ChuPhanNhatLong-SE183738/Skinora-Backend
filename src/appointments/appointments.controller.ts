import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../users/enums/role.enum';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('appointments')
@ApiBearerAuth()
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.USER, Role.ADMIN, Role.DOCTOR)
  async create(@Body() createAppointmentDto: CreateAppointmentDto) {
    const appointment = await this.appointmentsService.create(createAppointmentDto);
    return {
      success: true,
      message: 'Appointment scheduled successfully',
      data: appointment
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async findAll() {
    const appointments = await this.appointmentsService.findAll();
    return {
      success: true,
      message: 'Appointments retrieved successfully',
      data: appointments
    };
  }

  @Get('user/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.USER, Role.ADMIN)
  async findByUser(@Param('userId') userId: string) {
    const appointments = await this.appointmentsService.findByUser(userId);
    return {
      success: true,
      message: 'User appointments retrieved successfully',
      data: appointments
    };
  }

  @Get('doctor/:doctorId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DOCTOR, Role.ADMIN)
  async findByDoctor(@Param('doctorId') doctorId: string) {
    const appointments = await this.appointmentsService.findByDoctor(doctorId);
    return {
      success: true,
      message: 'Doctor appointments retrieved successfully',
      data: appointments
    };
  }

  @Get('availability/:doctorId')
  async checkAvailability(
    @Param('doctorId') doctorId: string, 
    @Query('date') date: string
  ) {
    const availability = await this.appointmentsService.checkDoctorAvailability(doctorId, date);
    return {
      success: true,
      message: 'Doctor availability retrieved successfully',
      data: availability
    };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string) {
    const appointment = await this.appointmentsService.findOne(id);
    return {
      success: true,
      message: 'Appointment retrieved successfully',
      data: appointment
    };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.USER, Role.DOCTOR, Role.ADMIN)
  async update(@Param('id') id: string, @Body() updateAppointmentDto: UpdateAppointmentDto) {
    const appointment = await this.appointmentsService.update(id, updateAppointmentDto);
    return {
      success: true,
      message: 'Appointment updated successfully',
      data: appointment
    };
  }

  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.USER, Role.DOCTOR, Role.ADMIN)
  async cancelAppointment(@Param('id') id: string) {
    const appointment = await this.appointmentsService.cancelAppointment(id);
    return {
      success: true,
      message: 'Appointment cancelled successfully',
      data: appointment
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async remove(@Param('id') id: string) {
    const result = await this.appointmentsService.remove(id);
    return {
      success: true,
      message: 'Appointment deleted successfully',
      data: result
    };
  }
}
