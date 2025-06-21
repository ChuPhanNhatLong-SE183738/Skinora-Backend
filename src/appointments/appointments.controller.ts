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
  HttpException,
  HttpStatus,
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
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('appointments')
@ApiBearerAuth()
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.USER, Role.ADMIN, Role.DOCTOR)
  @ApiOperation({ 
    summary: 'Create a new appointment',
    description: 'Schedule a new appointment with a doctor. Requires active subscription with available meetings.'
  })  @ApiBody({
    type: CreateAppointmentDto,
    description: 'Appointment details',
    examples: {
      example1: {
        summary: 'Sample appointment',
        value: {
          userId: '507f1f77bcf86cd799439012',
          doctorId: '507f1f77bcf86cd799439011',
          date: '2025-01-15',
          timeSlot: '14:30'
        }
      }
    }
  })  @ApiResponse({ 
    status: 201, 
    description: 'Appointment created successfully',
    schema: {
      example: {
        success: true,
        message: 'Appointment scheduled successfully',
        data: {
          _id: '507f1f77bcf86cd799439011',
          userId: '507f1f77bcf86cd799439012',
          doctorId: '507f1f77bcf86cd799439013',
          startTime: '2025-01-15T14:30:00.000Z',
          endTime: '2025-01-15T15:00:00.000Z',
          appointmentStatus: 'scheduled',
          createdAt: '2025-01-15T10:00:00.000Z',
          updatedAt: '2025-01-15T10:00:00.000Z'
        }
      }
    }
  })  @ApiResponse({ 
    status: 400, 
    description: 'Bad request - Invalid data or subscription issues',
    schema: {
      example: {
        success: false,
        message: 'You need an active subscription to book appointments with doctors',
        error: 'SUBSCRIPTION_REQUIRED',
        code: 'INSUFFICIENT_MEETINGS'
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token' })
  async create(@Body() createAppointmentDto: CreateAppointmentDto) {
    try {
      const appointment = await this.appointmentsService.create(createAppointmentDto);
      return {
        success: true,
        message: 'Appointment scheduled successfully',
        data: appointment,
      };
    } catch (error) {
      if (error.message.includes('subscription') || error.message.includes('meetings')) {
        // Specific handling for subscription-related errors
        return {
          success: false,
          message: error.message,
          error: 'SUBSCRIPTION_REQUIRED',
          code: 'INSUFFICIENT_MEETINGS',
        };
      }

      // For other errors
      throw new HttpException(
        {
          success: false,
          message: error.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ 
    summary: 'Get all appointments (Admin only)',
    description: 'Retrieve all appointments in the system. Only accessible by administrators.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'All appointments retrieved successfully',    schema: {
      example: {
        success: true,
        message: 'Appointments retrieved successfully',
        data: [{
          _id: '507f1f77bcf86cd799439011',
          userId: '507f1f77bcf86cd799439012',
          doctorId: '507f1f77bcf86cd799439013',
          startTime: '2025-01-15T14:30:00.000Z',
          endTime: '2025-01-15T15:00:00.000Z',
          appointmentStatus: 'scheduled'
        }]
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
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
  @ApiOperation({ 
    summary: 'Get appointments by user ID',
    description: 'Retrieve all appointments for a specific user. Users can only access their own appointments, admins can access any user appointments.'
  })
  @ApiParam({
    name: 'userId',
    description: 'The ID of the user whose appointments to retrieve',
    example: '507f1f77bcf86cd799439012'
  })  @ApiResponse({ 
    status: 200, 
    description: 'User appointments retrieved successfully',
    schema: {
      example: {
        success: true,
        message: 'User appointments retrieved successfully',
        data: [{
          _id: '507f1f77bcf86cd799439011',
          userId: '507f1f77bcf86cd799439012',
          doctorId: '507f1f77bcf86cd799439013',
          startTime: '2025-01-15T14:30:00.000Z',
          endTime: '2025-01-15T15:00:00.000Z',
          appointmentStatus: 'scheduled'
        }]
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
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
  @ApiOperation({ 
    summary: 'Get appointments by doctor ID',
    description: 'Retrieve all appointments for a specific doctor. Doctors can only access their own appointments, admins can access any doctor appointments.'
  })
  @ApiParam({
    name: 'doctorId',
    description: 'The ID of the doctor whose appointments to retrieve',
    example: '507f1f77bcf86cd799439012'
  })  @ApiResponse({ 
    status: 200, 
    description: 'Doctor appointments retrieved successfully',
    schema: {
      example: {
        success: true,
        message: 'Doctor appointments retrieved successfully',
        data: [{
          _id: '507f1f77bcf86cd799439011',
          userId: '507f1f77bcf86cd799439012',
          doctorId: '507f1f77bcf86cd799439013',
          startTime: '2025-01-15T14:30:00.000Z',
          endTime: '2025-01-15T15:00:00.000Z',
          appointmentStatus: 'scheduled'
        }]
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async findByDoctor(@Param('doctorId') doctorId: string) {
    const appointments = await this.appointmentsService.findByDoctor(doctorId);
    return {
      success: true,
      message: 'Doctor appointments retrieved successfully',
      data: appointments,
    };
  }
  @Get('availability/:doctorId')
  @ApiOperation({ 
    summary: 'Check doctor availability',
    description: 'Check if a doctor is available on a specific date for appointments.'
  })
  @ApiParam({
    name: 'doctorId',
    description: 'The ID of the doctor to check availability for',
    example: '507f1f77bcf86cd799439012'
  })
  @ApiQuery({
    name: 'date',
    description: 'The date to check availability for (YYYY-MM-DD format)',
    example: '2025-01-15'
  })  @ApiResponse({ 
    status: 200, 
    description: 'Doctor availability retrieved successfully',
    schema: {
      example: {
        success: true,
        message: 'Doctor availability retrieved successfully',
        data: {
          available: true,
          timeSlots: ['09:00', '10:00', '14:00', '15:00'],
          pastSlotsRemoved: 2
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid doctor ID or date format' })
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
  @ApiOperation({ 
    summary: 'Get appointment by ID',
    description: 'Retrieve a specific appointment by its ID. Users can only access their own appointments unless they are admin/doctor.'
  })
  @ApiParam({
    name: 'id',
    description: 'The ID of the appointment to retrieve',
    example: '507f1f77bcf86cd799439011'
  })  @ApiResponse({ 
    status: 200, 
    description: 'Appointment retrieved successfully',
    schema: {
      example: {
        success: true,
        message: 'Appointment retrieved successfully',
        data: {
          _id: '507f1f77bcf86cd799439011',
          userId: '507f1f77bcf86cd799439012',
          doctorId: '507f1f77bcf86cd799439013',
          startTime: '2025-01-15T14:30:00.000Z',
          endTime: '2025-01-15T15:00:00.000Z',
          appointmentStatus: 'scheduled',
          callId: null,
          createdAt: '2025-01-15T10:00:00.000Z',
          updatedAt: '2025-01-15T10:00:00.000Z'
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
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
  @ApiOperation({ 
    summary: 'Update appointment',
    description: 'Update appointment details. Users can update their own appointments, doctors can update appointments they are assigned to, admins can update any appointment.'
  })
  @ApiParam({
    name: 'id',
    description: 'The ID of the appointment to update',
    example: '507f1f77bcf86cd799439011'
  })  @ApiBody({
    type: UpdateAppointmentDto,
    description: 'Updated appointment details',
    examples: {
      example1: {
        summary: 'Update appointment time',
        value: {
          date: '2025-01-16',
          timeSlot: '16:00'
        }
      }
    }
  })  @ApiResponse({ 
    status: 200, 
    description: 'Appointment updated successfully',
    schema: {
      example: {
        success: true,
        message: 'Appointment updated successfully',
        data: {
          _id: '507f1f77bcf86cd799439011',
          userId: '507f1f77bcf86cd799439012',
          doctorId: '507f1f77bcf86cd799439013',
          startTime: '2025-01-16T16:00:00.000Z',
          endTime: '2025-01-16T16:30:00.000Z',
          appointmentStatus: 'scheduled'
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
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
  @ApiOperation({ 
    summary: 'Cancel appointment',
    description: 'Cancel a scheduled appointment. Users can cancel their own appointments, doctors can cancel appointments assigned to them, admins can cancel any appointment.'
  })
  @ApiParam({
    name: 'id',
    description: 'The ID of the appointment to cancel',
    example: '507f1f77bcf86cd799439011'
  })  @ApiResponse({ 
    status: 200, 
    description: 'Appointment cancelled successfully',
    schema: {
      example: {
        success: true,
        message: 'Appointment cancelled successfully',
        data: {
          _id: '507f1f77bcf86cd799439011',
          userId: '507f1f77bcf86cd799439012',
          doctorId: '507f1f77bcf86cd799439013',
          startTime: '2025-01-15T14:30:00.000Z',
          endTime: '2025-01-15T15:00:00.000Z',
          appointmentStatus: 'cancelled'
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
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
  @ApiOperation({ 
    summary: 'Delete appointment (Admin only)',
    description: 'Permanently delete an appointment from the system. Only accessible by administrators.'
  })
  @ApiParam({
    name: 'id',
    description: 'The ID of the appointment to delete',
    example: '507f1f77bcf86cd799439011'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Appointment deleted successfully',
    schema: {
      example: {
        success: true,
        message: 'Appointment deleted successfully',
        data: {
          deleted: true
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
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
    summary: 'Start video call for appointment',
    description: 'Start a video call for an appointment. Can be initiated by either the patient or doctor.'
  })
  @ApiParam({
    name: 'id',
    description: 'The ID of the appointment to start the call for',
    example: '507f1f77bcf86cd799439011'
  })
  @ApiBody({
    description: 'Call configuration options',
    schema: {
      type: 'object',
      properties: {
        callType: {
          type: 'string',
          enum: ['video', 'voice'],
          default: 'video',
          description: 'Type of call to initiate'
        }
      }
    },
    examples: {
      videoCall: {
        summary: 'Start video call',
        value: { callType: 'video' }
      },
      voiceCall: {
        summary: 'Start voice call',
        value: { callType: 'voice' }
      }
    }
  })  @ApiResponse({
    status: 200,
    description: 'Video call initiated successfully',
    schema: {
      example: {
        success: true,
        message: 'Video call initiated successfully',
        data: {
          agoraAppId: 'your_agora_app_id',
          channelName: 'room_abc123',
          token: 'agora_rtc_token',
          uid: 12345,
          callId: '507f1f77bcf86cd799439011',
          roomId: 'room_abc123',
          userRole: 'patient',
          appointment: {
            id: '507f1f77bcf86cd799439011',
            startTime: '2025-01-15T14:30:00.000Z',
            endTime: '2025-01-15T15:00:00.000Z',
            status: 'scheduled'
          }
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
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
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Join existing video call for appointment',
    description: 'Join an existing video call for an appointment. The call must already be initiated by another participant.'
  })
  @ApiParam({
    name: 'id',
    description: 'The ID of the appointment with an ongoing call to join',
    example: '507f1f77bcf86cd799439011'
  })  @ApiResponse({
    status: 200,
    description: 'Joined video call successfully',
    schema: {
      example: {
        success: true,
        message: 'Joined video call successfully',
        data: {
          agoraAppId: 'your_agora_app_id',
          channelName: 'room_abc123',
          token: 'agora_rtc_token',
          uid: 54321,
          callId: '507f1f77bcf86cd799439011',
          callStatus: 'active',
          userRole: 'doctor',
          appointment: {
            id: '507f1f77bcf86cd799439011',
            startTime: '2025-01-15T14:30:00.000Z',
            endTime: '2025-01-15T15:00:00.000Z',
            status: 'scheduled'
          }
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token' })
  @ApiResponse({ status: 404, description: 'Appointment or active call not found' })
  async joinVideoCall(@Param('id') appointmentId: string, @Request() req: any) {
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
  @ApiOperation({ 
    summary: 'End video call for appointment',
    description: 'End an ongoing video call for an appointment. Can be called by either participant.'
  })
  @ApiParam({
    name: 'id',
    description: 'The ID of the appointment with an ongoing call to end',
    example: '507f1f77bcf86cd799439011'
  })
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
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token' })
  @ApiResponse({ status: 404, description: 'Appointment or active call not found' })
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
      console.error('Error joining video call:', error);
      return {
        success: false,
        message: error.message,
      };
    }
  }
  @Get('check-subscription/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ 
    summary: 'Check if user can book appointments',
    description: 'Verify if a user has a valid subscription with available meeting slots to book appointments.'
  })
  @ApiParam({
    name: 'userId',
    description: 'The ID of the user to check subscription status for',
    example: '507f1f77bcf86cd799439012'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'User can book appointments',
    schema: {
      example: {
        success: true,
        message: 'User has a valid subscription with available meetings',
        canBook: true
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'User cannot book appointments due to subscription issues',    schema: {
      example: {
        success: false,
        message: 'You need an active subscription to book appointments with doctors',
        canBook: false,
        error: 'NO_SUBSCRIPTION'
      }
    }
  })
  async checkSubscriptionForBooking(@Param('userId') userId: string) {
    try {
      await this.appointmentsService.verifyUserSubscription(userId);
      return {
        success: true,
        message: 'User has a valid subscription with available meetings',
        canBook: true,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        canBook: false,
        error: error.message.includes('meetings') ? 'INSUFFICIENT_MEETINGS' : 'NO_SUBSCRIPTION',
      };
    }
  }
}
