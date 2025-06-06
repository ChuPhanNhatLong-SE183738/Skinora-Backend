import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatHistory, ChatHistorySchema } from './entities/chat_history.entity';
import { ChatHistoryService } from './chat_history.service';
import { ChatHistoryController } from './chat_history.controller';
import { ChatMessage, ChatMessageSchema } from '../chat_messages/entities/chat_message.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatHistory.name, schema: ChatHistorySchema },
      { name: ChatMessage.name, schema: ChatMessageSchema },
    ]),
  ],
  controllers: [ChatHistoryController],
  providers: [ChatHistoryService],
  exports: [ChatHistoryService],
})
export class ChatHistoryModule {}
