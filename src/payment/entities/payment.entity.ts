import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PaymentDocument = Payment & Document;

@Schema({ timestamps: true })
export class Payment {
  @Prop({ required: true })
  userId: string;

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
  payosOrderCode: string;

  @Prop()
  payosTransactionId: string;

  @Prop({ type: Object })
  payosResponse: any;

  @Prop()
  paidAt: Date;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
