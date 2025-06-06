import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type ChatHistoryDocument = ChatHistory & Document;

@Schema({ timestamps: true })
export class ChatHistory {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Users', required: true })
  userId: Types.ObjectId | MongooseSchema.Types.ObjectId;

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'ChatMessage' }], default: [] })
  messages: Types.ObjectId[]; 
}

export const ChatHistorySchema = SchemaFactory.createForClass(ChatHistory);
