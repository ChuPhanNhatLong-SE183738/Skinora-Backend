import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ChatMessagesService } from './chat_messages.service';
import { CreateChatMessageDto } from './dto/create-chat_message.dto';
import { UpdateChatMessageDto } from './dto/update-chat_message.dto';
import { ApiTags, ApiOperation, ApiParam, ApiBody } from '@nestjs/swagger';
import { successResponse } from '../helper/response.helper';

@ApiTags('chat-messages')
@Controller('chat-messages')
export class ChatMessagesController {
  constructor(private readonly chatMessagesService: ChatMessagesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a chat message' })
  @ApiBody({ type: CreateChatMessageDto })
  async createMessage(@Body() dto: CreateChatMessageDto) {
    const message = await this.chatMessagesService.createMessage(dto);
    return successResponse(message, 'Chat message created', 201);
  }

  @Get()
  findAll() {
    return this.chatMessagesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.chatMessagesService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateChatMessageDto: UpdateChatMessageDto) {
    return this.chatMessagesService.update(+id, updateChatMessageDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.chatMessagesService.remove(+id);
  }

  @Get('chat/:chatHistoryId')
  @ApiOperation({ summary: 'Get all messages for a chat history' })
  @ApiParam({ name: 'chatHistoryId', type: String, description: 'Chat History ID (Mongo ObjectId)' })
  async getAllByChatHistoryId(
    @Param('chatHistoryId') chatHistoryId: string,
  ) {
    const messages = await this.chatMessagesService.findAllByChatHistoryId(chatHistoryId);
    return successResponse(messages, 'Chat messages fetched');
  }
}
