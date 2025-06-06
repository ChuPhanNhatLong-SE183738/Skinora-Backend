import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateChatMessageDto } from './dto/create-chat_message.dto';
import { UpdateChatMessageDto } from './dto/update-chat_message.dto';
import { ChatMessage, ChatMessageDocument } from './entities/chat_message.entity';
import { ChatHistory, ChatHistoryDocument } from '../chat_history/entities/chat_history.entity';

@Injectable()
export class ChatMessagesService {
  constructor(
    @InjectModel(ChatMessage.name)
    private readonly chatMessageModel: Model<ChatMessageDocument>,
    @InjectModel(ChatHistory.name)
    private readonly chatHistoryModel: Model<ChatHistoryDocument>,
  ) {}

  create(createChatMessageDto: CreateChatMessageDto) {
    return 'This action adds a new chatMessage';
  }

  findAll() {
    return `This action returns all chatMessages`;
  }

  findOne(id: number) {
    return `This action returns a #${id} chatMessage`;
  }

  update(id: number, updateChatMessageDto: UpdateChatMessageDto) {
    return `This action updates a #${id} chatMessage`;
  }

  remove(id: number) {
    return `This action removes a #${id} chatMessage`;
  }

  async findAllByChatHistoryId(chatHistoryId: string): Promise<ChatMessage[]> {
    return this.chatMessageModel.find({ chatId: new Types.ObjectId(chatHistoryId) }).exec();
  }

  async createMessage(dto: CreateChatMessageDto): Promise<ChatMessage> {
    const message = await this.chatMessageModel.create({
      chatId: new Types.ObjectId(dto.chatId),
      sender: dto.sender,
      messageContent: dto.messageContent,
    });

    // Optionally, ensure the chat history belongs to the userId
    await this.chatHistoryModel.updateOne(
      { _id: new Types.ObjectId(dto.chatId), userId: new Types.ObjectId(dto.userId) },
      { $push: { messages: message._id } }
    );

    return message;
  }
}
