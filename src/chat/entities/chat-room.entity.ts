import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({
  timestamps: true,
  collection: 'chatrooms', // Specify exact collection name
})
export class ChatRoom {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  patientId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Doctor', required: true })
  doctorId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Appointment' })
  appointmentId: Types.ObjectId;

  @Prop({ default: 'active', enum: ['active', 'closed', 'archived'] })
  status: string;

  @Prop({ type: Types.ObjectId, ref: 'ChatMessage' })
  lastMessageId: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  lastActivity: Date;

  @Prop({ default: 0 })
  unreadCountPatient: number;

  @Prop({ default: 0 })
  unreadCountDoctor: number;
}

export type ChatRoomDocument = ChatRoom & Document;
export const ChatRoomSchema = SchemaFactory.createForClass(ChatRoom);

// Add indexes
ChatRoomSchema.index({ patientId: 1, doctorId: 1 });
ChatRoomSchema.index({ status: 1, lastActivity: -1 });
