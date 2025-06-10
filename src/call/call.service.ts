import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Call, CallDocument } from './entities/call.entity';
import { User, UserDocument } from '../users/entities/user.entity';
import { Doctor, DoctorDocument } from '../doctors/entities/doctor.entity';
import { SubscriptionService } from '../subscription/subscription.service';
import { AgoraService } from './agora.service';

@Injectable()
export class CallService {
  private readonly logger = new Logger(CallService.name);

  constructor(
    @InjectModel(Call.name) private callModel: Model<CallDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Doctor.name) private doctorModel: Model<DoctorDocument>, // Add Doctor model
    private subscriptionService: SubscriptionService,
    private agoraService: AgoraService, // Add AgoraService injection
  ) {}

  async initiateCall(
    patientId: string,
    doctorId: string,
    callType: 'video' | 'voice' = 'video',
  ): Promise<any> {
    this.logger.log(
      `Initiating ${callType} call between patient ${patientId} and doctor ${doctorId}`,
    );

    // Validate Agora configuration
    if (!this.agoraService.isConfigured()) {
      throw new BadRequestException(
        'Video call service is not properly configured',
      );
    }

    // Validate input IDs
    if (!Types.ObjectId.isValid(patientId)) {
      console.error(`Invalid patient ID format: ${patientId}`);
      throw new BadRequestException('Invalid patient ID format');
    }
    if (!Types.ObjectId.isValid(doctorId)) {
      console.error(`Invalid doctor ID format: ${doctorId}`);
      throw new BadRequestException('Invalid doctor ID format');
    }

    // Check if doctor exists in Doctor collection
    console.log('Checking doctor in Doctor collection...');
    const doctor = await this.doctorModel.findById(doctorId).exec();
    console.log(
      'Doctor found:',
      doctor ? { id: doctor._id, fullName: doctor.fullName } : null,
    );

    if (!doctor) {
      throw new BadRequestException('Doctor not found or not available');
    }

    console.log('Doctor validation passed');

    // Check who initiated the call to determine subscription logic
    const isInitiatedByDoctor = doctorId === patientId; // This means a doctor is calling (using their own ID as patientId)

    let subscription: any = null;

    if (!isInitiatedByDoctor) {
      // Only check subscription if call is initiated by patient
      console.log('Checking patient subscription...');
      subscription =
        await this.subscriptionService.getCurrentSubscription(patientId);

      console.log('Patient subscription:', subscription);

      if (!subscription) {
        throw new BadRequestException(
          'Active subscription required to make calls',
        );
      }

      // Check if patient has remaining meetings
      if (subscription.meetingsUsed >= subscription.meetingAmount) {
        throw new BadRequestException(
          'Meeting limit exceeded for current subscription',
        );
      }

      console.log('Subscription check passed');
    } else {
      console.log('Call initiated by doctor - skipping subscription check');
    }

    // Create call record
    const call = new this.callModel({
      patientId: new Types.ObjectId(patientId),
      doctorId: new Types.ObjectId(doctorId),
      callType,
      status: 'ringing',
      subscriptionId: subscription ? subscription._id : undefined,
    });

    const savedCall = await call.save();

    // Generate unique channel name
    const channelName = this.agoraService.generateChannelName(
      callType,
      patientId,
      doctorId,
    );
    const patientUid = this.agoraService.generateUid();
    const doctorUid = this.agoraService.generateUid();

    const patientToken = this.agoraService.generateRtcToken(
      channelName,
      patientUid,
    );
    const doctorToken = this.agoraService.generateRtcToken(
      channelName,
      doctorUid,
    );

    // Update call with Agora info
    savedCall.roomId = channelName;
    await savedCall.save();

    // Get patient info for doctor notification
    const patientInfo = await this.userModel
      .findById(patientId)
      .select('fullName avatarUrl')
      .exec();

    if (!patientInfo) {
      throw new NotFoundException('Patient not found');
    }

    return {
      callId: savedCall._id,
      channelName,
      patientToken,
      patientUid,
      doctorInfo: {
        id: doctor._id,
        name: doctor.fullName,
        avatar: doctor.photoUrl,
      },
      agoraAppId: this.agoraService.getAppId(),
    };
  }

  async acceptCall(callId: string, doctorId: string) {
    const call = await this.callModel.findById(callId).exec();

    if (!call || call.doctorId.toString() !== doctorId) {
      throw new NotFoundException('Call not found or unauthorized');
    }

    if (call.status !== 'ringing') {
      throw new BadRequestException('Call is not in ringing state');
    }

    call.status = 'accepted';
    call.startTime = new Date();
    await call.save();

    // Only use meeting from subscription if it exists (patient initiated call)
    if (call.subscriptionId) {
      await this.subscriptionService.useMeeting(call.subscriptionId.toString());
    }

    // Generate patient token for the call
    const patientUid = this.agoraService.generateUid();
    const patientToken = this.agoraService.generateRtcToken(
      call.roomId,
      patientUid,
    );

    return {
      success: true,
      call,
      channelName: call.roomId,
      agoraAppId: process.env.AGORA_APP_ID,
    };
  }

  async declineCall(callId: string, doctorId: string) {
    const call = await this.callModel.findById(callId).exec();

    if (!call || call.doctorId.toString() !== doctorId) {
      throw new NotFoundException('Call not found or unauthorized');
    }

    call.status = 'declined';
    await call.save();

    // Notify patient that call was declined
    // this.callGateway.notifyUser(call.patientId.toString(), 'call_declined', {
    //   callId: call._id,
    //   message: 'Doctor declined the call',
    // });

    return call;
  }

  async endCall(callId: string, userId: string, notes?: string): Promise<Call> {
    const call = await this.callModel.findById(callId).exec();

    if (!call) {
      throw new NotFoundException(`Call with ID ${callId} not found`);
    }

    if (call.status === 'ended') {
      throw new BadRequestException('Call has already ended');
    }

    // Verify user has permission to end the call
    const isPatient = call.patientId.toString() === userId;
    const isDoctor = call.doctorId.toString() === userId;

    if (!isPatient && !isDoctor) {
      throw new BadRequestException('You are not authorized to end this call');
    }

    // Update call details
    call.status = 'ended';
    call.endTime = new Date();
    call.endReason = 'completed';

    if (notes) {
      call.notes = notes;
    }

    // Calculate duration if startTime exists
    if (call.startTime) {
      const duration = Math.floor(
        (call.endTime.getTime() - call.startTime.getTime()) / 1000,
      );
      call.duration = duration;
    }

    const updatedCall = await call.save();

    this.logger.log(
      `Call ${callId} ended by user ${userId}. Duration: ${updatedCall.duration || 0} seconds`,
    );

    return updatedCall;
  }

  async addCallNotes(callId: string, notes: string, doctorId: string) {
    const call = await this.callModel.findById(callId).exec();

    if (!call || call.doctorId.toString() !== doctorId) {
      throw new NotFoundException('Call not found');
    }

    call.notes = notes;
    await call.save();

    return call;
  }

  async getCallHistory(userId: string) {
    return this.callModel
      .find({
        $or: [
          { patientId: new Types.ObjectId(userId) },
          { doctorId: new Types.ObjectId(userId) },
        ],
      })
      .populate('patientId', 'fullName avatarUrl')
      .populate('doctorId', 'fullName avatarUrl')
      .populate('appointmentId')
      .sort({ createdAt: -1 })
      .exec();
  }

  async getCallById(callId: string): Promise<Call> {
    const call = await this.callModel
      .findById(callId)
      .populate('patientId', 'fullName avatarUrl')
      .populate('doctorId', 'fullName photoUrl')
      .populate('appointmentId', 'startTime endTime appointmentStatus') // Populate appointment info
      .exec();

    if (!call) {
      throw new NotFoundException(`Call with ID ${callId} not found`);
    }

    return call;
  }

  async getCallByIdRaw(callId: string) {
    this.logger.log(`Finding raw call by ID: ${callId}`);

    if (!Types.ObjectId.isValid(callId)) {
      throw new BadRequestException('Invalid call ID format');
    }

    const call = await this.callModel.findById(callId).exec();

    if (!call) {
      this.logger.warn(`Call not found: ${callId}`);
      return null;
    }

    this.logger.log(`Found raw call: ${call._id}`);
    return call;
  }

  async getActiveCallForUser(userId: string) {
    this.logger.log(`Finding active call for user: ${userId}`);

    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    const call = await this.callModel
      .findOne({
        $or: [
          { patientId: new Types.ObjectId(userId) },
          { doctorId: new Types.ObjectId(userId) },
        ],
        status: { $in: ['ringing', 'accepted', 'active'] }, // Active statuses
      })
      .populate('patientId', 'fullName avatarUrl email')
      .populate('doctorId', 'fullName photoUrl email specializations')
      .populate('appointmentId')
      .sort({ createdAt: -1 }) // Get most recent active call
      .exec();

    if (!call) {
      this.logger.log(`No active call found for user: ${userId}`);
      return null;
    }

    this.logger.log(`Found active call: ${call._id} for user: ${userId}`);
    return call;
  }

  async getCallByAppointmentId(appointmentId: string) {
    this.logger.log(`Finding call by appointmentId: ${appointmentId}`);

    if (!Types.ObjectId.isValid(appointmentId)) {
      throw new BadRequestException('Invalid appointment ID format');
    }

    const call = await this.callModel
      .findOne({
        appointmentId: new Types.ObjectId(appointmentId),
        status: { $ne: 'ended' }, // Only get active calls
      })
      .populate('patientId', 'fullName avatarUrl email')
      .populate('doctorId', 'fullName photoUrl email specializations')
      .populate('appointmentId')
      .exec();

    if (!call) {
      this.logger.warn(
        `No active call found for appointment: ${appointmentId}`,
      );
      return null;
    }

    this.logger.log(
      `Found call: ${call._id} for appointment: ${appointmentId}`,
    );
    return call;
  }

  async initiateCallWithRole(
    patientId: string,
    doctorId: string,
    callType: 'video' | 'voice' = 'video',
    appointmentId?: string,
    isDoctorInitiated = false,
  ) {
    this.logger.log(
      `Initiating ${callType} call between patient ${patientId} and doctor ${doctorId}`,
    );

    // Generate unique room ID
    const roomId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Generate UIDs for both participants
    const patientUid = this.agoraService.generateUid();
    const doctorUid = this.agoraService.generateUid();

    // Generate tokens for both participants
    const patientToken = this.agoraService.generateRtcToken(roomId, patientUid);
    const doctorToken = this.agoraService.generateRtcToken(roomId, doctorUid);

    const callData = {
      patientId: new Types.ObjectId(patientId),
      doctorId: new Types.ObjectId(doctorId),
      roomId,
      callType,
      status: 'pending', // Change from 'active' to 'pending'
      startTime: new Date(),
      appointmentId: appointmentId
        ? new Types.ObjectId(appointmentId)
        : undefined,
      initiatedBy: isDoctorInitiated ? 'doctor' : 'patient',
      agoraConfig: {
        channelName: roomId,
        appId: this.agoraService.getAppId(),
        patientToken,
        doctorToken,
        patientUid,
        doctorUid,
      },
    };

    const newCall = new this.callModel(callData);
    const savedCall = await newCall.save();

    this.logger.log(
      `✅ Call created with ID: ${savedCall._id}, status: ${savedCall.status}`,
    );

    return {
      callId: savedCall._id,
      roomId,
      callType,
      status: savedCall.status,

      // Agora configuration
      agoraAppId: this.agoraService.getAppId(),
      appId: this.agoraService.getAppId(), // Backup field name
      channelName: roomId,

      // Tokens for both participants
      patientToken,
      doctorToken,
      token: isDoctorInitiated ? doctorToken : patientToken, // Current user's token

      // UIDs
      patientUid,
      doctorUid,
      uid: isDoctorInitiated ? doctorUid : patientUid, // Current user's UID

      // Participants
      patientId,
      doctorId,

      // Metadata
      startTime: savedCall.startTime,
      appointmentId,
      initiatedBy: callData.initiatedBy,

      message: `${callType} call initiated successfully`,

      // Debug info
      debug: {
        hasAgoraAppId: !!this.agoraService.getAppId(),
        hasPatientToken: !!patientToken,
        hasDoctorToken: !!doctorToken,
        roomIdGenerated: roomId,
        callStatus: savedCall.status,
      },
    };
  }

  // Add method to update call status
  async updateCallStatus(callId: string, status: string): Promise<Call> {
    const validStatuses = [
      'pending',
      'active',
      'ringing',
      'connected',
      'ended',
      'missed',
      'declined',
    ];

    if (!validStatuses.includes(status)) {
      throw new BadRequestException(`Invalid call status: ${status}`);
    }

    const call = await this.callModel
      .findByIdAndUpdate(
        callId,
        {
          status,
          ...(status === 'connected' && { startTime: new Date() }),
          ...(status === 'ended' && { endTime: new Date() }),
        },
        { new: true },
      )
      .exec();

    if (!call) {
      throw new NotFoundException(`Call with ID ${callId} not found`);
    }

    return call;
  }

  async getIncomingCallForUser(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    // Find calls where the user is either patient or doctor and status is 'ringing'
    const incomingCall = await this.callModel
      .findOne({
        $or: [
          { patientId: new Types.ObjectId(userId) },
          { doctorId: new Types.ObjectId(userId) },
        ],
        status: 'ringing',
        createdAt: { $gte: new Date(Date.now() - 30000) }, // Only calls from last 30 seconds
      })
      .populate('patientId', 'fullName avatarUrl')
      .populate('doctorId', 'fullName photoUrl')
      .sort({ createdAt: -1 })
      .exec();

    return incomingCall;
  }
}
