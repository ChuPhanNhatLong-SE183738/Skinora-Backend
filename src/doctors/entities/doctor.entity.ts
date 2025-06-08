import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Doctor {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true, minlength: 8 })
  password: string;

  @Prop({ required: true })
  fullName: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ type: Date })
  dob: Date;

  @Prop()
  address: string;

  @Prop()
  skinAnalysisHistory: string[];

  @Prop()
  purchaseHistory: string[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isVerified: boolean;

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Specialization' }],
  })
  specializations: Types.ObjectId[] | string[];

  @Prop()
  photoUrl: string;

  @Prop({ type: Object })
  availability: {
    monday: {
      isAvailable: boolean;
      timeRanges: { start: string; end: string }[];
      timeSlots: string[];
    };
    tuesday: {
      isAvailable: boolean;
      timeRanges: { start: string; end: string }[];
      timeSlots: string[];
    };
    wednesday: {
      isAvailable: boolean;
      timeRanges: { start: string; end: string }[];
      timeSlots: string[];
    };
    thursday: {
      isAvailable: boolean;
      timeRanges: { start: string; end: string }[];
      timeSlots: string[];
    };
    friday: {
      isAvailable: boolean;
      timeRanges: { start: string; end: string }[];
      timeSlots: string[];
    };
    saturday: {
      isAvailable: boolean;
      timeRanges: { start: string; end: string }[];
      timeSlots: string[];
    };
    sunday: {
      isAvailable: boolean;
      timeRanges: { start: string; end: string }[];
      timeSlots: string[];
    };
  };

  @Prop({ type: Date })
  lastLoginAt: Date;
}

export type DoctorDocument = Doctor & Document;
export const DoctorSchema = SchemaFactory.createForClass(Doctor);
