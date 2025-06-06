import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { ChatHistoryService } from './chat_history.service';
import { CreateChatHistoryDto } from './dto/create-chat_history.dto';
import { UpdateChatHistoryDto } from './dto/update-chat_history.dto';
import { successResponse, SuccessResponse } from '../helper/response.helper';
import { ChatHistory } from './entities/chat_history.entity';
import { ParseUUIDPipe } from '@nestjs/common';

@ApiTags('chat-history')
@Controller('chat-history')
export class ChatHistoryController {
  constructor(private readonly chatHistoryService: ChatHistoryService) {}

  @Post(':userId')
  @ApiOperation({ summary: 'Create chat history for a user' })
  @ApiParam({ name: 'userId', type: String, description: 'User ID (Mongo ObjectId)' })
  async createByUserId(
    @Param('userId') userId: string,
  ) {
    const chatHistory = await this.chatHistoryService.createByUserId(userId);
    return successResponse(chatHistory, 'Chat history created', 201);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get all chat histories for a user' })
  @ApiParam({ name: 'userId', type: String, description: 'User ID (Mongo ObjectId)' })
  async getAllByUserId(
    @Param('userId') userId: string,
  ) {
    const histories = await this.chatHistoryService.findAllByUserId(userId);
    return successResponse(histories, 'Chat histories fetched');
  }

  @Delete(':chatHistoryId')
  @ApiOperation({summary: 'Delete a chat history by ID' })
  @ApiParam({ name: 'chatHistoryId', type: String, description: 'Chat History ID (Mongo ObjectId)' })
  async deleteChatHistoryAndMessages(
    @Param('chatHistoryId') chatHistoryId: string,
  ) {
    await this.chatHistoryService.deleteChatHistoryAndMessages(chatHistoryId)
    return successResponse(null, 'Chat history and messages deleted');
  }
}
