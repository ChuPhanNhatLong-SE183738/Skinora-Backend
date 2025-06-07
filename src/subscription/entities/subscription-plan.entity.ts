import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SubscriptionPlanDocument = SubscriptionPlan & Document;

@Schema({ timestamps: true })
export class SubscriptionPlan {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  price: number; // Monthly price

  @Prop({ required: true })
  duration: number; // in months

  @Prop({ required: true })
  aiUsageAmount: number; // AI tokens included

  @Prop({ required: true })
  meetingAmount: number; // Number of meetings allowed

  @Prop({ default: true })
  isActive: boolean; // Can be purchased or not

  @Prop({ default: 0 })
  sortOrder: number; // For display ordering
}

export const SubscriptionPlanSchema =
  SchemaFactory.createForClass(SubscriptionPlan);
