import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SpecializationDocument = Specialization & Document;

@Schema({ timestamps: true })
export class Specialization {
  @Prop({ required: true })
  specializationName: string;

  @Prop()
  description: string;
  
  @Prop({ default: true })
  isActive: boolean;
}

export const SpecializationSchema = SchemaFactory.createForClass(Specialization);

SpecializationSchema.index({ specializationName: 1 }, { unique: true });
