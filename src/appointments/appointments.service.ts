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
    private chatService: ChatService, // Add ChatService injection
  ) {}

  async create(createAppointmentDto: CreateAppointmentDto) {
    const { userId, doctorId, date, timeSlot } = createAppointmentDto;

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

    // Only add paymentId if it was provided
    if (createAppointmentDto.paymentId) {
      appointmentData.paymentId = new Types.ObjectId(
        createAppointmentDto.paymentId,
      );
    }

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

      return savedAppointment;
    } catch (error) {
      this.logger.error(`Failed to save appointment: ${error.message}`);
      throw new BadRequestException(
        `Failed to create appointment: ${error.message}`,
      );
    }
  }

  async findAll() {
    return await this.appointmentModel
      .find()
      .populate('userId', 'fullName email')
      .populate('doctorId', 'fullName email')
      .exec();
  }

  async findByUser(userId: string) {
    return await this.appointmentModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate('doctorId', 'fullName email photoUrl')
      .sort({ startTime: 1 })
      .exec();
  }

  async findByDoctor(doctorId: string) {
    return await this.appointmentModel
      .find({ doctorId: new Types.ObjectId(doctorId) })
      .populate('userId', 'fullName email')
      .sort({ startTime: 1 })
      .exec();
  }

  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid appointment ID format');
    }

    const appointment = await this.appointmentModel
      .findById(id)
      .populate('userId', 'fullName email')
      .populate('doctorId', 'fullName email')
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
      this.logger.error(
        `Patient ID valid: ${Types.ObjectId.isValid(patientId)}, Doctor ID valid: ${Types.ObjectId.isValid(doctorId)}`,
      );
      throw new BadRequestException('Invalid user ID format in appointment');
    }

    // Determine user role for response (fallback to patient if not found)
    const isPatient = patientId === userId;
    const isDoctor = doctorId === userId;
    const userRole = isPatient ? 'patient' : isDoctor ? 'doctor' : 'patient';

    this.logger.log(
      `User role determination - isPatient: ${isPatient}, isDoctor: ${isDoctor}, userRole: ${userRole}`,
    );

    try {
      // Initiate call using CallService
      this.logger.log(`Initiating call with CallService...`);
      const callResult = await this.callService.initiateCall(
        patientId,
        doctorId,
        callType,
        appointmentId,
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
        message: `Video call initiated for appointment - Testing Mode`,
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

    if (!appointment.callId) {
      throw new BadRequestException('No active call for this appointment');
    }

    // TODO: Add back authorization check later
    // For testing: allow anyone to join
    const isPatient = appointment.userId.toString() === userId;
    const isDoctor = appointment.doctorId.toString() === userId;
    const userRole = isPatient ? 'patient' : isDoctor ? 'doctor' : 'tester';

    // Get call details
    const call = await this.callService.getCallById(
      appointment.callId.toString(),
    );

    if (call.status === 'ended') {
      throw new BadRequestException('Call has already ended');
    }

    // Generate new token for joining user
    const uid = Math.floor(Math.random() * 100000) + 1;
    const token = this.agoraService.generateRtcToken(call.roomId, uid);

    return {
      callId: call._id,
      channelName: call.roomId,
      token,
      uid,
      userRole,
      callStatus: call.status,
      otherParticipant: isPatient ? call.doctorId : call.patientId,
      agoraAppId: this.agoraService.getAppId(),
      appointment: {
        id: appointment._id,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
      },
      message: 'Ready to join video call - Testing Mode',
    };
  }
}
