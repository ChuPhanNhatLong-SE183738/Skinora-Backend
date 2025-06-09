import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type ChatMessageDocument = ChatMessages & Document;

@Schema({ timestamps: true })
export class ChatMessages {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'ChatHistory', required: true })
  chatId: Types.ObjectId | MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  sender: string;

  @Prop({ required: true })
  messageContent: string;
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessages);
