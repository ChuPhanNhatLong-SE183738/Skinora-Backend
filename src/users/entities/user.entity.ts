import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Role } from '../enums/role.enum';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true })
  email: string;

  @Prop({ required: true, minlength: 6 })
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
  avatarUrl: string;

  @Prop({ type: [Object], default: [] })
  skinAnalysisHistory: any[];

  @Prop({ type: [Object], default: [] })
  purchaseHistory: any[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isVerified: boolean;

  @Prop({ enum: [Role.USER, Role.DOCTOR, Role.ADMIN], default: Role.USER })
  role: string;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;
  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
  @Prop({ type: String, default: null })
  verificationToken: string | null;

  @Prop({ type: Date, default: null })
  verificationTokenCreatedAt: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'Subscription' })
  currentSubscription: Types.ObjectId;
}

export const UserSchema = SchemaFactory.createForClass(User);
