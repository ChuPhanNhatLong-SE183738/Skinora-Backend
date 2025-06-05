import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ timestamps: true })
export class RecommendedProducts {
  @Prop({ required: true })
  recommendationId: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Analysis',
    required: true,
  })
  analysisId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ required: true })
  reason: string;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export type RecommendedProductsDocument = RecommendedProducts & Document;
export const RecommendedProductsSchema =
  SchemaFactory.createForClass(RecommendedProducts);

// Add indexes for better performance
RecommendedProductsSchema.index({ analysisId: 1 });
RecommendedProductsSchema.index({ productId: 1 });
RecommendedProductsSchema.index({ recommendationId: 1 });
