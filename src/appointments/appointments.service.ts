import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { Appointment, AppointmentDocument } from './entities/appointment.entity';
import { DoctorsService } from '../doctors/doctors.service';
import { UsersService } from '../users/users.service';
import { GoogleCalendarService } from './services/google-calendar.service';

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);
  
  constructor(
    @InjectModel(Appointment.name) private appointmentModel: Model<AppointmentDocument>,
    private doctorsService: DoctorsService,
    private usersService: UsersService,
    private googleCalendarService: GoogleCalendarService
  ) {}

  async create(createAppointmentDto: CreateAppointmentDto) {
    const { userId, doctorId, date, timeSlot } = createAppointmentDto;

    const doctor = await this.doctorsService.findOne(doctorId);
    if (!doctor) {
      throw new NotFoundException(`Doctor with ID ${doctorId} not found`);
    }

    const dateObj = new Date(date);
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dateObj.getDay()];
    
    const dayAvailability = doctor.availability[dayOfWeek];
    if (!dayAvailability || !dayAvailability.isAvailable) {
      throw new BadRequestException(`Doctor is not available on ${dayOfWeek}`);
    }

    if (!dayAvailability.timeSlots.includes(timeSlot)) {
      throw new BadRequestException(`Time slot ${timeSlot} is not available for this doctor on ${dayOfWeek}`);
    }

    const [hours, minutes] = timeSlot.split(':').map(num => parseInt(num, 10));
    const startTime = new Date(date);
    startTime.setHours(hours, minutes, 0, 0);
    
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + 30); 
    
    const existingAppointment = await this.appointmentModel.findOne({
      doctorId: new Types.ObjectId(doctorId),
      startTime: { $lte: endTime },
      endTime: { $gt: startTime },
      appointmentStatus: { $ne: 'cancelled' }
    }).exec();
    
    if (existingAppointment) {
      throw new BadRequestException('This time slot is already booked');
    }

    // Get user and doctor information for the calendar event
    const user = await this.usersService.findOne(userId);
    const doctorDetails = await this.doctorsService.findOne(doctorId);

    // Generate a default meeting URL as fallback
    const fallbackMeetingUrl = `https://meet.google.com/${Date.now().toString(36)}-${Math.random().toString(36).substring(2)}`;
    let googleEventId: string | null = null;
    let meetingUrl = fallbackMeetingUrl;

    // Skip Google Calendar integration if we know it's not configured properly
    if (process.env.SKIP_GOOGLE_CALENDAR !== 'true') {
      try {
        this.logger.log('Attempting to create Google Calendar event');
        
        const calendarEvent = await this.googleCalendarService.createMeetingLink(
          `Skinora Appointment: ${user.fullName} with Dr. ${doctorDetails.fullName}`,
          `Skinora video consultation appointment`,
          startTime,
          endTime,
          [
            { email: user.email },
            { email: doctorDetails.email }
          ]
        );

        googleEventId = calendarEvent.eventId;
        meetingUrl = calendarEvent.meetLink;
        this.logger.log(`Successfully created Google Calendar event with ID: ${googleEventId}`);
      } catch (error) {
        if (error.message === 'Google Calendar service not properly configured') {
          this.logger.warn('Google Calendar integration is not configured. Using fallback meeting URL.');
          // Set an environment variable to avoid further attempts in this session
          process.env.SKIP_GOOGLE_CALENDAR = 'true';
        } else {
          // Enhanced error logging with full error object
          this.logger.error('Failed to create Google Calendar event:', error);
        }
        this.logger.log(`Using fallback meeting URL: ${fallbackMeetingUrl}`);
      }
    } else {
      this.logger.log('Skipping Google Calendar integration as it is not properly configured.');
    }

    // Create the appointment document without requiring googleEventId
    const appointmentData: any = {
      userId: new Types.ObjectId(userId),
      doctorId: new Types.ObjectId(doctorId),
      startTime,
      endTime,
      meetingUrl,
      appointmentStatus: 'scheduled'
    };

    // Only add googleEventId if we have it
    if (googleEventId) {
      appointmentData.googleEventId = googleEventId;
    }

    // Only add paymentId if it was provided
    if (createAppointmentDto.paymentId) {
      appointmentData.paymentId = new Types.ObjectId(createAppointmentDto.paymentId);
    }

    try {
      const newAppointment = new this.appointmentModel(appointmentData);
      const savedAppointment = await newAppointment.save();
      this.logger.log(`Appointment created successfully with ID: ${savedAppointment._id}`);
      return savedAppointment;
    } catch (error) {
      this.logger.error(`Failed to save appointment: ${error.message}`);
      
      // If we created a Google Calendar event but failed to save the appointment,
      // we should clean up by deleting the calendar event
      if (googleEventId) {
        try {
          await this.googleCalendarService.cancelMeeting(googleEventId);
          this.logger.log(`Cleaned up Google Calendar event ${googleEventId} after appointment save failure`);
        } catch (calendarError) {
          // Enhanced error logging with full error object
          this.logger.error('Failed to clean up Google Calendar event:', calendarError);
        }
      }
      
      throw new BadRequestException(`Failed to create appointment: ${error.message}`);
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
    
    // Cancel the Google Calendar event if it exists
    if (appointment.googleEventId) {
      try {
        await this.googleCalendarService.cancelMeeting(appointment.googleEventId);
        this.logger.log(`Cancelled Google Calendar event: ${appointment.googleEventId}`);
      } catch (error) {
        // Enhanced error logging with full error object
        this.logger.error('Failed to cancel Google Calendar event:', error);
        // Continue with appointment cancellation even if calendar event cancellation fails
      }
    }

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
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dateObj.getDay()];
    
    const dayAvailability = doctor.availability[dayOfWeek];
    if (!dayAvailability || !dayAvailability.isAvailable) {
      return { available: false, timeSlots: [] };
    }

    const availableTimeSlots = [...dayAvailability.timeSlots];

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const bookedAppointments = await this.appointmentModel.find({
      doctorId: new Types.ObjectId(doctorId),
      startTime: { $gte: startOfDay, $lt: endOfDay },
      appointmentStatus: { $ne: 'cancelled' }
    }).exec();
    
    bookedAppointments.forEach(appointment => {
      const hours = appointment.startTime.getHours().toString().padStart(2, '0');
      const minutes = appointment.startTime.getMinutes().toString().padStart(2, '0');
      const timeSlot = `${hours}:${minutes}`;
      
      const index = availableTimeSlots.indexOf(timeSlot);
      if (index !== -1) {
        availableTimeSlots.splice(index, 1);
      }
    });
    
    return {
      available: availableTimeSlots.length > 0,
      timeSlots: availableTimeSlots
    };
  }

  private async sendAppointmentConfirmationEmails(appointment, user, doctor) {
    // Placeholder for email notification implementation
    // You would typically inject an EmailService and send emails to both parties with meeting details
    console.log('Sending appointment confirmation emails to', user.email, 'and', doctor.email);
    console.log('Meeting URL:', appointment.meetingUrl);
  }

  private async sendAppointmentCancellationEmails(appointment) {
    // Placeholder for cancellation email notification
    console.log('Sending appointment cancellation emails');
  }
}
