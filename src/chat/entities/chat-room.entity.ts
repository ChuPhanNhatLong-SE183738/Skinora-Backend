import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ timestamps: true })
export class ChatRoom {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  patientId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Doctor', required: true })
  doctorId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Appointment' })
  appointmentId?: Types.ObjectId;

  @Prop({ type: String }) // Changed from ObjectId to String
  lastMessage?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Message' })
  lastMessageId?: Types.ObjectId;

  @Prop({ type: Date })
  lastMessageTime?: Date;

  @Prop({ type: Date, default: Date.now })
  lastActivity: Date;

  @Prop({ type: Number, default: 0 })
  unreadCountPatient: number;

  @Prop({ type: Number, default: 0 })
  unreadCountDoctor: number;

  @Prop({
    type: String,
    enum: ['active', 'archived', 'deleted'],
    default: 'active',
  })
  status: string;
}

export type ChatRoomDocument = ChatRoom & Document;
export const ChatRoomSchema = SchemaFactory.createForClass(ChatRoom);

// Create indexes for better performance
ChatRoomSchema.index({ patientId: 1, doctorId: 1 }, { unique: true });
ChatRoomSchema.index({ lastActivity: -1 });
