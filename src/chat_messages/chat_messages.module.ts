import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatMessage, ChatMessageSchema } from './entities/chat_message.entity';
import { ChatMessagesService } from './chat_messages.service';
import { ChatMessagesController } from './chat_messages.controller';
import { ChatHistory, ChatHistorySchema } from '../chat_history/entities/chat_history.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatMessage.name, schema: ChatMessageSchema },
      { name: ChatHistory.name, schema: ChatHistorySchema },
    ]),
  ],
  controllers: [ChatMessagesController],
  providers: [ChatMessagesService],
  exports: [ChatMessagesService],
})
export class ChatMessagesModule {}
