import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

@Schema({
  timestamps: true,
  collection: 'messages', // Explicitly set collection name
})
export class Message {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'ChatRoom',
    required: true,
  })
  chatRoomId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
    enum: ['patient', 'doctor'],
  })
  senderType: 'patient' | 'doctor';

  @Prop({ type: String, required: true })
  content: string;

  @Prop({
    type: String,
    enum: ['text', 'image', 'file'],
    default: 'text',
  })
  messageType: 'text' | 'image' | 'file';

  @Prop({ type: String })
  fileUrl: string;

  @Prop({ type: String })
  fileName: string;

  @Prop({ type: [String] })
  attachments: string[];

  @Prop({ type: Date, default: Date.now })
  timestamp: Date;

  @Prop({ type: Boolean, default: false })
  isRead: boolean;

  @Prop({ type: Boolean, default: false })
  isDeleted: boolean;
}

export type MessageDocument = Message & Document;
export const MessageSchema = SchemaFactory.createForClass(Message);

// Create indexes for better performance
MessageSchema.index({ chatRoomId: 1, timestamp: -1 });
MessageSchema.index({ senderId: 1 });
