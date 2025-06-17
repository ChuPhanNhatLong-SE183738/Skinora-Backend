import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Message {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'ChatRoom',
    required: true,
  })
  chatRoomId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  @Prop({ required: true })
  messageText: string;

  @Prop({
    type: String,
    enum: ['text', 'image', 'file'],
    default: 'text',
  })
  messageType: string;

  @Prop()
  fileUrl: string;

  @Prop({ type: [String] }) // Array of file URLs for multiple attachments
  attachments: string[];

  @Prop() // Original filename
  fileName: string;

  @Prop() // File size in bytes
  fileSize: number;

  @Prop() // File MIME type
  mimeType: string;

  @Prop({ type: Date, default: Date.now })
  timestamp: Date;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;

  @Prop({ type: Date })
  readAt?: Date;

  @Prop({ type: Boolean, default: false })
  isRead: boolean;
}

export type MessageDocument = Message & Document;
export const MessageSchema = SchemaFactory.createForClass(Message);

// Add indexes for better performance
MessageSchema.index({ chatRoomId: 1, timestamp: -1 });
MessageSchema.index({ senderId: 1 });
