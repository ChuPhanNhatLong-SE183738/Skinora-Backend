import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Recommendation {
  @Prop({ required: true })
  recommendationId: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ required: true })
  reason: string;
}

export const RecommendationSchema =
  SchemaFactory.createForClass(Recommendation);

@Schema({ timestamps: true })
export class Analysis {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  imageUrl: string;

  @Prop({ required: true })
  skinType: string;

  @Prop({ required: true, default: Date.now })
  analysisDate: Date;

  @Prop({
    type: [RecommendationSchema],
    required: true,
    default: [],
  })
  recommendedProducts: Recommendation[];

  @Prop({ required: true })
  result: string;
}

export type AnalysisDocument = Analysis & Document;
export const AnalysisSchema = SchemaFactory.createForClass(Analysis);
