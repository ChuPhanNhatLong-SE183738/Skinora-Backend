import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

@Schema({
  timestamps: true,
  collection: 'chatrooms', // Specify exact collection name
})
export class ChatRoom {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  patientId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  doctorId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Appointment' })
  appointmentId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Message' })
  lastMessage: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  lastActivity: Date;

  @Prop({ type: Number, default: 0 })
  messageCount: number;

  @Prop({ type: Boolean, default: true })
  patientActive: boolean;

  @Prop({ type: Boolean, default: true })
  doctorActive: boolean;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;
}

export type ChatRoomDocument = ChatRoom & Document;
export const ChatRoomSchema = SchemaFactory.createForClass(ChatRoom);

// Create indexes for better performance
ChatRoomSchema.index({ patientId: 1, doctorId: 1 }, { unique: true });
ChatRoomSchema.index({ lastActivity: -1 });
