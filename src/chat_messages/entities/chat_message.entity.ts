import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type ChatMessageDocument = ChatMessage & Document;

@Schema({ timestamps: true })
export class ChatMessage {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'ChatHistory', required: true })
  chatId: Types.ObjectId | MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  sender: string;

  @Prop({ required: true })
  messageContent: string;
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);
