import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PaymentDocument = Payment & Document;

@Schema({ timestamps: true })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Subscription', required: true })
  subscriptionId: Types.ObjectId;

  @Prop({ required: true })
  amount: number;

  @Prop({ default: 'VND' })
  currency: string;

  @Prop({
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending',
  })
  status: string;

  @Prop({ default: 'payos' })
  paymentMethod: string;

  @Prop()
  description: string;

  @Prop()
  sepayId: string;

  @Prop()
  sepayReferenceCode: string;

  @Prop({ type: Object })
  sepayWebhook: any;

  @Prop({ type: Date, default: null })
  paidAt: Date | null;

  @Prop()
  orderCode: string;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
