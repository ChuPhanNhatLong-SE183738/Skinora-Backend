import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import {
  Appointment,
  AppointmentDocument,
} from './entities/appointment.entity';
import { DoctorsService } from '../doctors/doctors.service';
import { UsersService } from '../users/users.service';
import { CallService } from '../call/call.service';
import { AgoraService } from '../call/agora.service';
import { ChatService } from '../chat/chat.service';
import { SubscriptionService } from '../subscription/subscription.service'; // Add this import

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    @InjectModel(Appointment.name)
    private appointmentModel: Model<AppointmentDocument>,
    private doctorsService: DoctorsService,
    private usersService: UsersService,
    private callService: CallService,
    private agoraService: AgoraService,
    private chatService: ChatService,
    private subscriptionService: SubscriptionService, // Add this injection
  ) {}

  /**
   * Verify if user has an active subscription with available meetings
   */
  async verifyUserSubscription(userId: string): Promise<string> {
    this.logger.log(`Verifying subscription for user: ${userId}`);

    // Get current subscription
    const subscription =
      await this.subscriptionService.getCurrentSubscription(userId);

    // Check if subscription exists and is active
    if (!subscription) {
      this.logger.warn(`No active subscription found for user ${userId}`);
      throw new BadRequestException(
        'You need an active subscription to book appointments with doctors',
      );
    }

    // Check if user has meetings left in their subscription
    if (subscription.meetingsUsed >= subscription.meetingAmount) {
      this.logger.warn(
        `User ${userId} has used all meetings in subscription (${subscription.meetingsUsed}/${subscription.meetingAmount})`,
      );
      throw new BadRequestException(
        `You have used all meetings in your current subscription (${subscription.meetingsUsed}/${subscription.meetingAmount}). Please upgrade your plan.`,
      );
    }

    this.logger.log(
      `User ${userId} has a valid subscription with ${subscription.meetingAmount - subscription.meetingsUsed} meetings left`,
    );
    return (subscription as any)._id.toString(); // Return the subscription ID for later use
  }

  /**
   * Verify if appointment time is valid (not in the past)
   */
  private verifyAppointmentTime(date: string, timeSlot: string): void {
    this.logger.log(`Verifying appointment time: ${date} ${timeSlot}`);

    const [hours, minutes] = timeSlot
      .split(':')
      .map((num) => parseInt(num, 10));
    const appointmentDateTime = new Date(date);
    appointmentDateTime.setHours(hours, minutes, 0, 0);

    const now = new Date();

    // Add a small buffer (e.g., 5 minutes) to prevent issues when appointment time is very close to current time
    const bufferMinutes = 5;
    const minimumValidTime = new Date();
    minimumValidTime.setMinutes(now.getMinutes() + bufferMinutes);

    if (appointmentDateTime < minimumValidTime) {
      const formattedApptTime = appointmentDateTime.toLocaleString();
      const formattedNow = now.toLocaleString();
      this.logger.warn(
        `Appointment time ${formattedApptTime} is in the past (current time: ${formattedNow})`,
      );
      throw new BadRequestException(
        `Cannot book appointments in the past or less than ${bufferMinutes} minutes from now. Selected time: ${formattedApptTime}, Current time: ${formattedNow}`,
      );
    }

    this.logger.log(
      `Appointment time validation passed for ${date} ${timeSlot}`,
    );
  }

  async create(createAppointmentDto: CreateAppointmentDto) {
    const { userId, doctorId, date, timeSlot } = createAppointmentDto;

    // Verify appointment time is not in the past
    this.verifyAppointmentTime(date, timeSlot);

    // Verify user has an active subscription with available meetings and get subscription ID
    const subscriptionId = await this.verifyUserSubscription(userId);

    // Continue with the existing doctor availability checks
    const doctor = await this.doctorsService.findOne(doctorId);
    if (!doctor) {
      throw new NotFoundException(`Doctor with ID ${doctorId} not found`);
    }

    const dateObj = new Date(date);
    const dayOfWeek = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ][dateObj.getDay()];

    const dayAvailability = doctor.availability[dayOfWeek];
    if (!dayAvailability || !dayAvailability.isAvailable) {
      throw new BadRequestException(`Doctor is not available on ${dayOfWeek}`);
    }

    if (!dayAvailability.timeSlots.includes(timeSlot)) {
      throw new BadRequestException(
        `Time slot ${timeSlot} is not available for this doctor on ${dayOfWeek}`,
      );
    }

    const [hours, minutes] = timeSlot
      .split(':')
      .map((num) => parseInt(num, 10));
    const startTime = new Date(date);
    startTime.setHours(hours, minutes, 0, 0);

    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + 30);

    const existingAppointment = await this.appointmentModel
      .findOne({
        doctorId: new Types.ObjectId(doctorId),
        startTime: { $lte: endTime },
        endTime: { $gt: startTime },
        appointmentStatus: { $ne: 'cancelled' },
      })
      .exec();

    if (existingAppointment) {
      throw new BadRequestException('This time slot is already booked');
    }

    // Create the appointment document
    const appointmentData: any = {
      userId: new Types.ObjectId(userId),
      doctorId: new Types.ObjectId(doctorId),
      startTime,
      endTime,
      appointmentStatus: 'scheduled',
    };

    try {
      const newAppointment = new this.appointmentModel(appointmentData);
      const savedAppointment = await newAppointment.save();
      this.logger.log(
        `Appointment created successfully with ID: ${savedAppointment._id}`,
      );

      // Auto-create chat room for the appointment
      try {
        await this.chatService.createChatRoom({
          patientId: createAppointmentDto.userId,
          doctorId: createAppointmentDto.doctorId,
          appointmentId: (savedAppointment._id as any).toString(),
        });
        this.logger.log(
          `Chat room created for appointment ${savedAppointment._id}`,
        );
      } catch (chatError) {
        this.logger.warn(`Failed to create chat room: ${chatError.message}`);
        // Don't fail appointment creation if chat room fails
      }

      // Record meeting usage in subscription
      try {
        await this.subscriptionService.useMeeting(subscriptionId);
        this.logger.log(
          `Meeting usage recorded in subscription: ${subscriptionId}`,
        );
      } catch (error) {
        this.logger.error(`Failed to record meeting usage: ${error.message}`);
        // Don't fail appointment creation if updating subscription fails
        // But log the error for monitoring
      }

      return savedAppointment;
    } catch (error) {
      this.logger.error(`Failed to save appointment: ${error.message}`);
      throw new BadRequestException(
        `Failed to create appointment: ${error.message}`,
      );
    }
  }
  async findAll(filters?: {
    status?: string;
    doctorName?: string;
    userName?: string;
    search?: string;
    userId?: string;
    doctorId?: string;
    date?: string;
    startDate?: string;
    endDate?: string;
  }) {
    // If no filters, return all appointments with population
    if (!filters || Object.keys(filters).length === 0) {
      return await this.appointmentModel
        .find()
        .populate('userId', 'fullName email phoneNumber profilePicture')
        .populate(
          'doctorId',
          'fullName email phoneNumber photoUrl specializations experience',
        )
        .sort({ startTime: -1 })
        .exec();
    }

    // Use aggregation pipeline for advanced filtering with name search
    const pipeline: any[] = [];

    // Stage 1: Match basic filters
    const matchStage: any = {};

    if (filters.status) {
      matchStage.appointmentStatus = filters.status;
    }

    if (filters.userId) {
      matchStage.userId = new Types.ObjectId(filters.userId);
    }

    if (filters.doctorId) {
      matchStage.doctorId = new Types.ObjectId(filters.doctorId);
    }

    // Date filtering
    if (filters.date) {
      const startOfDay = new Date(filters.date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(filters.date);
      endOfDay.setHours(23, 59, 59, 999);
      matchStage.startTime = { $gte: startOfDay, $lte: endOfDay };
    } else if (filters.startDate && filters.endDate) {
      const start = new Date(filters.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      matchStage.startTime = { $gte: start, $lte: end };
    }

    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    // Stage 2: Lookup user data
    pipeline.push({
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'userId',
        pipeline: [
          {
            $project: {
              fullName: 1,
              email: 1,
              phoneNumber: 1,
              profilePicture: 1,
            },
          },
        ],
      },
    });

    // Stage 3: Lookup doctor data
    pipeline.push({
      $lookup: {
        from: 'doctors',
        localField: 'doctorId',
        foreignField: '_id',
        as: 'doctorId',
        pipeline: [
          {
            $project: {
              fullName: 1,
              email: 1,
              phoneNumber: 1,
              photoUrl: 1,
              specializations: 1,
              experience: 1,
            },
          },
        ],
      },
    });

    // Stage 4: Unwind the populated arrays to make them objects
    pipeline.push(
      { $unwind: { path: '$userId', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$doctorId', preserveNullAndEmptyArrays: true } },
    );

    // Stage 5: Filter by names if specified
    const nameMatchStage: any = {};

    if (filters.doctorName) {
      nameMatchStage['doctorId.fullName'] = {
        $regex: filters.doctorName,
        $options: 'i',
      };
    }

    if (filters.userName) {
      nameMatchStage['userId.fullName'] = {
        $regex: filters.userName,
        $options: 'i',
      };
    }

    if (filters.search) {
      nameMatchStage.$or = [
        { 'doctorId.fullName': { $regex: filters.search, $options: 'i' } },
        { 'userId.fullName': { $regex: filters.search, $options: 'i' } },
        { 'doctorId.email': { $regex: filters.search, $options: 'i' } },
        { 'userId.email': { $regex: filters.search, $options: 'i' } },
      ];
    }

    if (Object.keys(nameMatchStage).length > 0) {
      pipeline.push({ $match: nameMatchStage });
    }

    // Stage 6: Sort
    pipeline.push({ $sort: { startTime: -1 } });

    // Execute aggregation
    const appointments = await this.appointmentModel.aggregate(pipeline).exec();
    return appointments;
  }
  async findByUser(userId: string) {
    return await this.appointmentModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate('userId', 'fullName email phoneNumber profilePicture')
      .populate(
        'doctorId',
        'fullName email phoneNumber photoUrl specializations experience',
      )
      .sort({ startTime: 1 })
      .exec();
  }
  async findByDoctor(doctorId: string) {
    return await this.appointmentModel
      .find({ doctorId: new Types.ObjectId(doctorId) })
      .populate('userId', 'fullName email phoneNumber profilePicture')
      .populate(
        'doctorId',
        'fullName email phoneNumber photoUrl specializations experience',
      )
      .sort({ startTime: 1 })
      .exec();
  }
  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid appointment ID format');
    }

    const appointment = await this.appointmentModel
      .findById(id)
      .populate('userId', 'fullName email phoneNumber profilePicture')
      .populate(
        'doctorId',
        'fullName email phoneNumber photoUrl specializations experience',
      )
      .exec();

    if (!appointment) {
      throw new NotFoundException(`Appointment with ID ${id} not found`);
    }

    return appointment;
  }

  // Add new method to get appointment without populate
  async findOneRaw(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid appointment ID format');
    }

    const appointment = await this.appointmentModel.findById(id).exec();

    if (!appointment) {
      throw new NotFoundException(`Appointment with ID ${id} not found`);
    }

    return appointment;
  }
  async update(id: string, updateAppointmentDto: UpdateAppointmentDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid appointment ID format');
    }

    const appointment = await this.appointmentModel
      .findByIdAndUpdate(id, updateAppointmentDto, { new: true })
      .populate('userId', 'fullName email phoneNumber profilePicture')
      .populate(
        'doctorId',
        'fullName email phoneNumber photoUrl specializations experience',
      )
      .exec();

    if (!appointment) {
      throw new NotFoundException(`Appointment with ID ${id} not found`);
    }

    return appointment;
  }
  /**
   * Updates appointment status and handles related subscription meeting tracking
   */
  async updateAppointmentStatus(
    id: string,
    status: 'scheduled' | 'completed' | 'cancelled',
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid appointment ID format');
    }

    const appointment = await this.appointmentModel
      .findByIdAndUpdate(id, { appointmentStatus: status }, { new: true })
      .populate('userId', 'fullName email phoneNumber profilePicture')
      .populate(
        'doctorId',
        'fullName email phoneNumber photoUrl specializations experience',
      )
      .exec();

    if (!appointment) {
      throw new NotFoundException(`Appointment with ID ${id} not found`);
    }

    return appointment;
  }

  async cancelAppointment(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid appointment ID format');
    }

    const appointment = await this.findOne(id);

    const updatedAppointment = await this.appointmentModel
      .findByIdAndUpdate(id, { appointmentStatus: 'cancelled' }, { new: true })
      .exec();

    // Send cancellation notification emails
    try {
      await this.sendAppointmentCancellationEmails(updatedAppointment);
    } catch (error) {
      this.logger.error(`Failed to send cancellation emails: ${error.message}`);
    }

    // Option: could implement refund of meeting to subscription if needed
    // await this.subscriptionService.refundMeeting(userId);

    return updatedAppointment;
  }

  async remove(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid appointment ID format');
    }

    const result = await this.appointmentModel.findByIdAndDelete(id).exec();

    if (!result) {
      throw new NotFoundException(`Appointment with ID ${id} not found`);
    }

    return { deleted: true };
  }

  async checkDoctorAvailability(doctorId: string, date: string) {
    const doctor = await this.doctorsService.findOne(doctorId);

    const dateObj = new Date(date);
    const dayOfWeek = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ][dateObj.getDay()];

    const dayAvailability = doctor.availability[dayOfWeek];
    if (!dayAvailability || !dayAvailability.isAvailable) {
      return { available: false, timeSlots: [] };
    }

    const availableTimeSlots = [...dayAvailability.timeSlots];

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const bookedAppointments = await this.appointmentModel
      .find({
        doctorId: new Types.ObjectId(doctorId),
        startTime: { $gte: startOfDay, $lt: endOfDay },
        appointmentStatus: { $ne: 'cancelled' },
      })
      .exec();

    // Remove booked time slots
    bookedAppointments.forEach((appointment) => {
      const hours = appointment.startTime
        .getHours()
        .toString()
        .padStart(2, '0');
      const minutes = appointment.startTime
        .getMinutes()
        .toString()
        .padStart(2, '0');
      const timeSlot = `${hours}:${minutes}`;

      const index = availableTimeSlots.indexOf(timeSlot);
      if (index !== -1) {
        availableTimeSlots.splice(index, 1);
      }
    });

    // Filter out time slots in the past
    const now = new Date();
    const isToday =
      dateObj.setHours(0, 0, 0, 0) === new Date().setHours(0, 0, 0, 0);

    if (isToday) {
      // Add a small buffer (e.g., 30 minutes) for upcoming appointments
      const bufferMinutes = 30;
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes() + bufferMinutes;

      const filteredTimeSlots = availableTimeSlots.filter((timeSlot) => {
        const [slotHour, slotMinute] = timeSlot
          .split(':')
          .map((num) => parseInt(num, 10));
        if (
          slotHour > currentHour ||
          (slotHour === currentHour && slotMinute > currentMinute)
        ) {
          return true;
        }
        return false;
      });

      return {
        available: filteredTimeSlots.length > 0,
        timeSlots: filteredTimeSlots,
        pastSlotsRemoved: availableTimeSlots.length - filteredTimeSlots.length,
      };
    }

    return {
      available: availableTimeSlots.length > 0,
      timeSlots: availableTimeSlots,
    };
  }

  private async sendAppointmentConfirmationEmails(appointment, user, doctor) {
    // Placeholder for email notification implementation
    console.log(
      'Sending appointment confirmation emails to',
      user.email,
      'and',
      doctor.email,
    );
    console.log('Appointment scheduled for video call via Agora');
  }

  private async sendAppointmentCancellationEmails(appointment) {
    // Placeholder for cancellation email notification
    console.log('Sending appointment cancellation emails');
  }

  async startVideoCall(appointmentId: string) {
    const appointment = await this.findOne(appointmentId);

    if (appointment.appointmentStatus !== 'scheduled') {
      throw new BadRequestException('Appointment is not scheduled');
    }

    // TODO: Add back 15-minute restriction later
    // Check if appointment time is within 15 minutes
    // const now = new Date();
    // const appointmentTime = new Date(appointment.startTime);
    // const timeDiff = Math.abs(now.getTime() - appointmentTime.getTime());
    // const minutesDiff = Math.ceil(timeDiff / (1000 * 60));

    // if (minutesDiff > 15) {
    //   throw new BadRequestException(
    //     'Video call can only be started within 15 minutes of appointment time',
    //   );
    // }

    return {
      appointmentId: appointment._id,
      patientId: appointment.userId,
      doctorId: appointment.doctorId,
      canStartCall: true,
      message: 'Ready to start video call',
    };
  }

  async updateCallId(appointmentId: string, callId: string) {
    // Validate IDs format
    if (!Types.ObjectId.isValid(appointmentId)) {
      throw new BadRequestException('Invalid appointment ID format');
    }
    if (!Types.ObjectId.isValid(callId)) {
      throw new BadRequestException('Invalid call ID format');
    }

    const appointment = await this.appointmentModel
      .findByIdAndUpdate(
        appointmentId,
        { callId: new Types.ObjectId(callId) },
        { new: true },
      )
      .exec();

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    return appointment;
  }

  async startVideoCallFromAppointment(
    appointmentId: string,
    userId: string,
    callType: 'video' | 'voice' = 'video',
  ) {
    this.logger.log(
      `Starting video call - appointmentId: ${appointmentId}, userId: ${userId}, callType: ${callType}`,
    );

    // Validate appointmentId format
    if (!Types.ObjectId.isValid(appointmentId)) {
      this.logger.error(`Invalid appointment ID format: ${appointmentId}`);
      throw new BadRequestException('Invalid appointment ID format');
    }

    // Get appointment details
    const appointment = await this.findOne(appointmentId);

    this.logger.log(`Found appointment:`, {
      id: appointment._id,
      userId: appointment.userId,
      doctorId: appointment.doctorId,
      userIdType: typeof appointment.userId,
      doctorIdType: typeof appointment.doctorId,
    });

    if (appointment.appointmentStatus !== 'scheduled') {
      throw new BadRequestException('Appointment is not scheduled');
    }

    // Check if call already exists for this appointment
    if (appointment.callId) {
      this.logger.log(
        `Call already exists for appointment: ${appointment.callId}`,
      );
      return this.joinVideoCall(appointmentId, userId);
    }

    // Extract the actual ObjectId strings from populated objects
    const patientId = (appointment.userId as any)._id
      ? (appointment.userId as any)._id.toString()
      : appointment.userId.toString();
    const doctorId = (appointment.doctorId as any)._id
      ? (appointment.doctorId as any)._id.toString()
      : appointment.doctorId.toString();

    this.logger.log(
      `Extracted IDs - patientId: ${patientId}, doctorId: ${doctorId}`,
    );

    // Validate user IDs
    if (
      !Types.ObjectId.isValid(patientId) ||
      !Types.ObjectId.isValid(doctorId)
    ) {
      this.logger.error(
        `Invalid user ID format - patientId: ${patientId}, doctorId: ${doctorId}`,
      );
      throw new BadRequestException('Invalid user ID format in appointment');
    }

    // Determine user role
    const isPatient = patientId === userId;
    const isDoctor = doctorId === userId;
    const userRole = isPatient ? 'patient' : isDoctor ? 'doctor' : 'patient';

    this.logger.log(
      `User role determination - isPatient: ${isPatient}, isDoctor: ${isDoctor}, userRole: ${userRole}`,
    );

    try {
      // Always use actual patientId and doctorId from appointment
      // Pass a flag to indicate if doctor initiated the call
      this.logger.log(`Initiating call with CallService...`);
      const callResult = await this.callService.initiateCallWithRole(
        patientId,
        doctorId,
        callType,
        appointmentId,
        isDoctor, // Pass flag to indicate if doctor initiated
      );

      this.logger.log(`Call initiated successfully:`, callResult);

      // Update appointment with call ID
      await this.updateCallId(
        appointmentId,
        (callResult.callId as any).toString(),
      );

      // Return call details with appointment info
      return {
        ...callResult,
        appointment: {
          id: appointment._id,
          startTime: appointment.startTime,
          endTime: appointment.endTime,
          status: appointment.appointmentStatus,
        },
        userRole,
        initiatedBy: userId,
        message: `Video call initiated for appointment - ${isDoctor ? 'Doctor Mode' : 'Patient Mode'}`,
      };
    } catch (error) {
      this.logger.error(`Error in startVideoCallFromAppointment:`, error);
      throw error;
    }
  }

  async joinVideoCall(appointmentId: string, userId: string) {
    // Validate appointmentId format
    if (!Types.ObjectId.isValid(appointmentId)) {
      throw new BadRequestException('Invalid appointment ID format');
    }

    const appointment = await this.appointmentModel
      .findById(appointmentId)
      .exec();

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    // Find call by appointmentId in calls table
    const activeCall =
      await this.callService.getCallByAppointmentId(appointmentId);

    if (!activeCall) {
      throw new BadRequestException(
        'No active call found for this appointment',
      );
    }

    // Allow joining if call is pending, active, or connected
    const allowedStatuses = ['pending', 'active', 'connected'];
    if (!allowedStatuses.includes(activeCall.status)) {
      throw new BadRequestException(
        `Cannot join call with status: ${activeCall.status}`,
      );
    }

    // Check authorization
    const isPatient = appointment.userId.toString() === userId;
    const isDoctor = appointment.doctorId.toString() === userId;

    if (!isPatient && !isDoctor) {
      throw new BadRequestException('You are not authorized to join this call');
    }

    const userRole = isPatient ? 'patient' : 'doctor';

    // Get call details
    const call = await this.callService.getCallById(
      appointment.callId.toString(),
    );

    if (!call) {
      throw new NotFoundException('Call not found');
    }

    // Update call status to active when someone joins
    if (call.status === 'pending') {
      await this.callService.updateCallStatus(
        (call as any)._id.toString(),
        'active',
      );
    }

    // Generate new token for joining user
    const uid = Math.floor(Math.random() * 100000) + 1;
    const token = this.agoraService.generateRtcToken(call.roomId, uid);

    this.logger.log(
      `📞 User ${userId} (${userRole}) joining call ${(call as any)._id}`,
    );

    return {
      appointment: {
        id: appointment._id,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        status: appointment.appointmentStatus,
      },
      // Agora configuration
      agoraAppId: this.agoraService.getAppId(),
      appId: this.agoraService.getAppId(), // Backup field name
      channelName: call.roomId,
      token: token,
      patientToken: token, // For compatibility
      doctorToken: token, // For compatibility
      uid: uid,

      // Call details
      callId: (call as any)._id,
      callStatus: 'active', // Return active status
      roomId: call.roomId,
      userRole,
      otherParticipant: isPatient ? call.doctorId : call.patientId,

      // Status
      canJoin: true,
      message: `Ready to join video call as ${userRole}`,

      // Debug info
      debug: {
        hasAgoraAppId: !!this.agoraService.getAppId(),
        hasToken: !!token,
        hasChannelName: !!call.roomId,
        generatedUid: uid,
        originalCallStatus: call.status,
      },
    };
  }

  async endVideoCall(appointmentId: string, userId: string) {
    this.logger.log(
      `Ending video call - appointmentId: ${appointmentId}, userId: ${userId}`,
    );

    // Validate appointmentId format
    if (!Types.ObjectId.isValid(appointmentId)) {
      throw new BadRequestException('Invalid appointment ID format');
    }

    const appointment = await this.appointmentModel
      .findById(appointmentId)
      .exec();

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (!appointment.callId) {
      throw new BadRequestException(
        'No active call found for this appointment',
      );
    }

    // Verify user has permission to end the call
    const isPatient = appointment.userId.toString() === userId;
    const isDoctor = appointment.doctorId.toString() === userId;

    if (!isPatient && !isDoctor) {
      throw new BadRequestException('You are not authorized to end this call');
    }

    try {
      // End the call using CallService
      const callResult = await this.callService.endCall(
        appointment.callId.toString(),
        userId,
      );

      if (!callResult) {
        throw new BadRequestException('Failed to end call');
      }

      this.logger.log(`Call ended successfully:`, callResult);

      // Update appointment status to completed
      await this.appointmentModel.findByIdAndUpdate(appointmentId, {
        appointmentStatus: 'completed',
      });

      return {
        callId: (callResult as any)._id,
        duration: callResult.duration,
        endTime: callResult.endTime,
        status: callResult.status,
        appointment: {
          id: appointment._id,
          status: 'completed',
        },
        endedBy: userId,
        userRole: isPatient ? 'patient' : 'doctor',
        message: 'Call ended successfully',
      };
    } catch (error) {
      this.logger.error(`Error ending call:`, error);
      throw error;
    }
  }
}
