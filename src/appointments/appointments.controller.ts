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
  Request,
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../users/enums/role.enum';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

@ApiTags('appointments')
@ApiBearerAuth()
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.USER, Role.ADMIN, Role.DOCTOR)
  async create(@Body() createAppointmentDto: CreateAppointmentDto) {
    const appointment =
      await this.appointmentsService.create(createAppointmentDto);
    return {
      success: true,
      message: 'Appointment scheduled successfully',
      data: appointment,
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
      data: appointments,
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
      data: appointments,
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
      data: appointments,
    };
  }

  @Get('availability/:doctorId')
  async checkAvailability(
    @Param('doctorId') doctorId: string,
    @Query('date') date: string,
  ) {
    const availability = await this.appointmentsService.checkDoctorAvailability(
      doctorId,
      date,
    );
    return {
      success: true,
      message: 'Doctor availability retrieved successfully',
      data: availability,
    };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string) {
    const appointment = await this.appointmentsService.findOne(id);
    return {
      success: true,
      message: 'Appointment retrieved successfully',
      data: appointment,
    };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.USER, Role.DOCTOR, Role.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateAppointmentDto: UpdateAppointmentDto,
  ) {
    const appointment = await this.appointmentsService.update(
      id,
      updateAppointmentDto,
    );
    return {
      success: true,
      message: 'Appointment updated successfully',
      data: appointment,
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
      data: appointment,
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
      data: result,
    };
  }

  @Post(':id/start-call')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Start video call for appointment (Patient or Doctor)',
  })
  async startVideoCallFromAppointment(
    @Param('id') appointmentId: string,
    @Request() req,
    @Body() body: { callType?: 'video' | 'voice' },
  ) {
    console.log('=== START CALL REQUEST ===');
    console.log('appointmentId from params:', appointmentId);
    console.log('req.user:', req.user);
    console.log('body:', body);
    console.log('========================');

    try {
      const userId = req.user.sub || req.user.id;
      const callType = body.callType || 'video';

      console.log('Extracted userId:', userId);
      console.log('Extracted callType:', callType);

      const result =
        await this.appointmentsService.startVideoCallFromAppointment(
          appointmentId,
          userId,
          callType,
        );

      console.log('Service result:', result);

      return {
        success: true,
        message: 'Video call initiated successfully',
        data: result,
      };
    } catch (error) {
      console.error('Controller error:', error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @Post(':id/join-call')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Join existing video call for appointment' })
  async joinVideoCall(@Param('id') appointmentId: string, @Request() req) {
    try {
      const userId = req.user.sub || req.user.id;
      const result = await this.appointmentsService.joinVideoCall(
        appointmentId,
        userId,
      );

      return {
        success: true,
        message: 'Joined video call successfully',
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @Post(':id/end-call')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'End video call for appointment' })
  @ApiResponse({
    status: 200,
    description: 'Call ended successfully',
    schema: {
      example: {
        success: true,
        message: 'Call ended successfully',
        data: {
          callId: '675...',
          duration: 1800, // seconds
          endTime: '2025-01-06T13:30:00.000Z',
          status: 'ended',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request',
    schema: {
      example: {
        success: false,
        message: 'Error message here',
      },
    },
  })
  async endVideoCall(
    @Param('id') appointmentId: string,
    @Request() req: { user: { sub?: string; id?: string } },
  ) {
    try {
      const userId = req.user.sub || req.user.id;

      if (!userId) {
        return {
          success: false,
          message: 'User ID not found in token',
        };
      }

      const result = await this.appointmentsService.endVideoCall(
        appointmentId,
        userId,
      );

      return {
        success: true,
        message: 'Call ended successfully',
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
