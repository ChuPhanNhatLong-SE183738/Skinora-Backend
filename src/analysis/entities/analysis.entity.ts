import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

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

  @Prop({ required: true })
  result: string;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export type AnalysisDocument = Analysis & Document;
export const AnalysisSchema = SchemaFactory.createForClass(Analysis);

// Add indexes for better performance
AnalysisSchema.index({ userId: 1 });
AnalysisSchema.index({ skinType: 1 });
AnalysisSchema.index({ analysisDate: -1 });
