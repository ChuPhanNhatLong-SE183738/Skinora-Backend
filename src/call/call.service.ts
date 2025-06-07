import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Call, CallDocument } from './entities/call.entity';
import { User, UserDocument } from '../users/entities/user.entity';
import { Doctor, DoctorDocument } from '../doctors/entities/doctor.entity';
import { SubscriptionService } from '../subscription/subscription.service';
import { AgoraService } from './agora.service';
import { CallGateway } from './call.gateway';

@Injectable()
export class CallService {
  constructor(
    @InjectModel(Call.name) private callModel: Model<CallDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Doctor.name) private doctorModel: Model<DoctorDocument>, // Add Doctor model
    private subscriptionService: SubscriptionService,
    private agoraService: AgoraService,
    private callGateway: CallGateway,
  ) {}

  async initiateCall(
    patientId: string,
    doctorId: string,
    callType: 'video' | 'voice',
    appointmentId?: string,
  ) {
    console.log('=== CALL SERVICE - INITIATE CALL ===');
    console.log('patientId:', patientId, 'type:', typeof patientId);
    console.log('doctorId:', doctorId, 'type:', typeof doctorId);
    console.log('appointmentId:', appointmentId, 'type:', typeof appointmentId);
    console.log('callType:', callType);
    console.log('===================================');

    // Validate input IDs
    if (!Types.ObjectId.isValid(patientId)) {
      console.error(`Invalid patient ID format: ${patientId}`);
      throw new BadRequestException('Invalid patient ID format');
    }
    if (!Types.ObjectId.isValid(doctorId)) {
      console.error(`Invalid doctor ID format: ${doctorId}`);
      throw new BadRequestException('Invalid doctor ID format');
    }
    if (appointmentId && !Types.ObjectId.isValid(appointmentId)) {
      console.error(`Invalid appointment ID format: ${appointmentId}`);
      throw new BadRequestException('Invalid appointment ID format');
    }

    console.log('All ID validations passed');

    // Check Agora configuration
    if (!this.agoraService.isConfigured()) {
      throw new BadRequestException(
        'Video call service is not configured. Please contact support.',
      );
    }

    console.log('Agora service is configured');

    // Check if patient has active subscription
    console.log('Checking patient subscription...');
    const subscription =
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

    // Create call record
    const call = new this.callModel({
      patientId: new Types.ObjectId(patientId),
      doctorId: new Types.ObjectId(doctorId),
      appointmentId: appointmentId
        ? new Types.ObjectId(appointmentId)
        : undefined,
      callType,
      status: 'ringing',
      subscriptionId: (subscription as any)._id,
    });

    const savedCall = await call.save();

    // Generate Agora channel and tokens
    const channelName = this.agoraService.generateChannelName(
      (savedCall._id as any).toString(),
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

    // Notify doctor via WebSocket
    this.callGateway.notifyUser(doctorId, 'incoming_call', {
      callId: savedCall._id,
      patientInfo: {
        id: patientId,
        name: patientInfo.fullName,
        avatar: patientInfo.avatarUrl,
      },
      callType,
      channelName,
      doctorToken,
      doctorUid,
      appointmentId,
    });

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
      appointmentId,
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

    // Use meeting from subscription
    await this.subscriptionService.useMeeting(call.subscriptionId.toString());

    // Generate patient token for the call
    const patientUid = this.agoraService.generateUid();
    const patientToken = this.agoraService.generateRtcToken(
      call.roomId,
      patientUid,
    );

    // Notify patient that call was accepted
    this.callGateway.notifyUser(call.patientId.toString(), 'call_accepted', {
      callId: call._id,
      channelName: call.roomId,
      patientToken,
      patientUid,
      agoraAppId: process.env.AGORA_APP_ID,
    });

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
    this.callGateway.notifyUser(call.patientId.toString(), 'call_declined', {
      callId: call._id,
      message: 'Doctor declined the call',
    });

    return call;
  }

  async endCall(callId: string, userId: string) {
    const call = await this.callModel.findById(callId).exec();

    if (!call) {
      throw new NotFoundException('Call not found');
    }

    // Check if user is participant in the call
    const isParticipant =
      call.patientId.toString() === userId ||
      call.doctorId.toString() === userId;
    if (!isParticipant) {
      throw new BadRequestException('Unauthorized to end this call');
    }

    call.status = 'ended';
    call.endTime = new Date();

    if (call.startTime) {
      call.duration = Math.floor(
        (call.endTime.getTime() - call.startTime.getTime()) / 1000,
      );
    }

    await call.save();

    // Notify other participant
    const otherUserId =
      call.patientId.toString() === userId
        ? call.doctorId.toString()
        : call.patientId.toString();

    this.callGateway.notifyUser(otherUserId, 'call_ended', {
      callId: call._id,
      duration: call.duration,
      endedBy: userId,
    });

    return call;
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

  async getCallById(callId: string) {
    const call = await this.callModel
      .findById(callId)
      .populate('patientId', 'fullName avatarUrl')
      .populate('doctorId', 'fullName avatarUrl')
      .populate('appointmentId')
      .exec();

    if (!call) {
      throw new NotFoundException('Call not found');
    }

    return call;
  }
}
