import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({
  timestamps: true,
  collection: 'chatmessages', // Specify exact collection name
})
export class ChatMessage {
  @Prop({ type: Types.ObjectId, ref: 'ChatRoom', required: true })
  chatRoomId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  senderId: Types.ObjectId;

  @Prop({ required: true, enum: ['patient', 'doctor'] })
  senderType: string;

  @Prop({ required: true, trim: true })
  content: string;

  @Prop({ default: 'text', enum: ['text', 'image', 'file', 'system'] })
  messageType: string;

  @Prop({ type: [String], default: [] })
  attachments: string[];

  @Prop({ default: false })
  isRead: boolean;

  @Prop({ type: Date })
  readAt: Date;

  @Prop({ default: false })
  isEdited: boolean;

  @Prop({ type: Date })
  editedAt: Date;
}

export type ChatMessageDocument = ChatMessage & Document;
export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);

// Add indexes for better performance
ChatMessageSchema.index({ chatRoomId: 1, createdAt: -1 });
ChatMessageSchema.index({ senderId: 1 });
