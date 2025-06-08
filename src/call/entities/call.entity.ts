import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CallDocument = Call & Document;

@Schema({ timestamps: true })
export class Call {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  patientId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  doctorId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Appointment' })
  appointmentId: Types.ObjectId;

  @Prop({
    enum: ['video', 'voice'],
    default: 'video',
  })
  callType: string;

  @Prop({
    enum: ['pending', 'ringing', 'accepted', 'declined', 'ended', 'missed'],
    default: 'pending',
  })
  status: string;

  @Prop()
  roomId: string; // For video call room (Agora/Jitsi)

  @Prop()
  startTime: Date;

  @Prop({ type: Date })
  endTime: Date;

  @Prop({ type: Number, default: 0 })
  duration: number; // in seconds

  @Prop()
  notes: string; // Doctor's notes after call

  @Prop({ type: Types.ObjectId, ref: 'Subscription' })
  subscriptionId: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  endedBy: Types.ObjectId; // userId who ended the call
}

export const CallSchema = SchemaFactory.createForClass(Call);
