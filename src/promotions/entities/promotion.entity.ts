import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Promotion {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true, min: 0, max: 100 })
  discountPercentage: number;

  @Prop({ required: true })
  startDate: Date;

  @Prop({ required: true })
  endDate: Date;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Product' }],
    default: [],
  })
  applicableProducts: Types.ObjectId[];

  @Prop({ min: 0 })
  minimumPurchase: number;

  @Prop({ min: 0 })
  maximumDiscount: number;

  @Prop({ min: 0, default: 0 })
  usageCount: number;

  @Prop({ min: 0 })
  usageLimit: number;

  @Prop()
  promoCode: string;

  @Prop({ default: 'percentage', enum: ['percentage', 'fixed'] })
  discountType: string;
}

export type PromotionDocument = Promotion & Document;
export const PromotionSchema = SchemaFactory.createForClass(Promotion);

// Add indexes for better performance
PromotionSchema.index({ promoCode: 1 });
PromotionSchema.index({ startDate: 1, endDate: 1 });
PromotionSchema.index({ isActive: 1 });
