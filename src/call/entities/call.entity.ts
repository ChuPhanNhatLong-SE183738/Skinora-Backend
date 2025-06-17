import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type CallDocument = Call & Document;

@Schema({ timestamps: true })
export class Call {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  patientId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Doctor', required: true })
  doctorId: Types.ObjectId;

  @Prop({ required: true })
  roomId: string;

  @Prop({
    type: String,
    enum: ['video', 'voice'],
    default: 'video',
  })
  callType: string;

  @Prop({
    type: String,
    enum: [
      'pending',
      'active',
      'ringing',
      'connected',
      'ended',
      'missed',
      'declined',
    ],
    default: 'pending',
  })
  status: string;

  @Prop({ type: Date, default: Date.now })
  startTime: Date;

  @Prop({ type: Date })
  endTime: Date;

  @Prop({ type: Number })
  duration: number; // in seconds

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Appointment' })
  appointmentId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Subscription' })
  subscriptionId: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['patient', 'doctor'],
    required: false,
  })
  initiatedBy: string;

  @Prop({ type: String })
  endReason: string; // 'completed', 'cancelled', 'failed', etc.

  @Prop({ type: String })
  notes: string; // Add notes field

  @Prop({ type: Object })
  agoraConfig: {
    channelName: string;
    appId: string;
    patientToken: string;
    doctorToken: string;
    patientUid: number;
    doctorUid: number;
  };
}

export const CallSchema = SchemaFactory.createForClass(Call);

// Add indexes for better performance
CallSchema.index({ patientId: 1, doctorId: 1 });
CallSchema.index({ appointmentId: 1 });
CallSchema.index({ status: 1 });
CallSchema.index({ startTime: -1 });
