import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SubscriptionDocument = Subscription & Document;

@Schema({ timestamps: true })
export class Subscription {
  @Prop({ type: Types.ObjectId, ref: 'SubscriptionPlan', required: true })
  planId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Date, required: true })
  startDate: Date;

  @Prop({ type: Date, required: true })
  endDate: Date;

  @Prop({
    enum: ['pending', 'active', 'expired', 'cancelled'],
    default: 'pending',
  })
  status: string;

  @Prop({ required: true })
  totalAmount: number; // Amount paid

  @Prop({ type: Types.ObjectId, ref: 'Payment' })
  paymentId: Types.ObjectId;

  @Prop({ default: 0 })
  aiUsageUsed: number;

  @Prop({ default: 0 })
  meetingsUsed: number;

  // Copy plan details at time of purchase (in case plan changes later)
  @Prop({ required: true })
  planName: string;

  @Prop({ required: true })
  aiUsageAmount: number;

  @Prop({ required: true })
  meetingAmount: number;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
