import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChatRoom, ChatRoomDocument } from './entities/chat-room.entity';
import {
  ChatMessage,
  ChatMessageDocument,
} from './entities/chat-message.entity';
import { CreateChatRoomDto } from './dto/create-chat-room.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { ChatGateway } from './chat.gateway';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectModel(ChatRoom.name)
    private chatRoomModel: Model<ChatRoomDocument>,
    @InjectModel(ChatMessage.name)
    private chatMessageModel: Model<ChatMessageDocument>,
    private chatGateway: ChatGateway,
  ) {}

  async createChatRoom(createChatRoomDto: CreateChatRoomDto) {
    try {
      this.logger.log(
        `🏠 Creating chat room: ${JSON.stringify(createChatRoomDto)}`,
      );

      // Check if chat room already exists
      const existingRoom = await this.chatRoomModel
        .findOne({
          patientId: new Types.ObjectId(createChatRoomDto.patientId),
          doctorId: new Types.ObjectId(createChatRoomDto.doctorId),
          status: { $ne: 'archived' },
        })
        .exec();

      if (existingRoom) {
        this.logger.log(`♻️ Chat room already exists: ${existingRoom._id}`);
        return existingRoom;
      }

      const chatRoom = new this.chatRoomModel({
        patientId: new Types.ObjectId(createChatRoomDto.patientId),
        doctorId: new Types.ObjectId(createChatRoomDto.doctorId),
        appointmentId: createChatRoomDto.appointmentId
          ? new Types.ObjectId(createChatRoomDto.appointmentId)
          : undefined,
        lastActivity: new Date(),
      });

      const savedRoom = await chatRoom.save();
      this.logger.log(`✅ Chat room created successfully: ${savedRoom._id}`);

      return savedRoom;
    } catch (error) {
      this.logger.error(`❌ Error creating chat room: ${error.message}`);
      throw error;
    }
  }

  async sendMessage(
    chatRoomId: string,
    senderId: string,
    senderType: 'patient' | 'doctor',
    sendMessageDto: SendMessageDto,
  ) {
    try {
      this.logger.log(
        `💬 Sending message - Room: ${chatRoomId}, Sender: ${senderId} (${senderType})`,
      );
      this.logger.log(`Message DTO:`, sendMessageDto);

      // Validate required fields - content is optional for file uploads
      const hasContent =
        sendMessageDto.content && sendMessageDto.content.trim();
      const hasAttachments =
        sendMessageDto.attachments && sendMessageDto.attachments.length > 0;

      if (!hasContent && !hasAttachments) {
        throw new BadRequestException(
          'Message must have content or attachments',
        );
      }

      // Validate chat room exists and user has access
      const chatRoom = await this.validateUserAccess(
        chatRoomId,
        senderId,
        senderType,
      );

      // Create message with exact field names matching schema
      const messageData = {
        chatRoomId: new Types.ObjectId(chatRoomId),
        senderId: new Types.ObjectId(senderId),
        senderType,
        content:
          sendMessageDto.content?.trim() ||
          (sendMessageDto.messageType === 'image'
            ? '📷 Image'
            : sendMessageDto.messageType === 'file'
              ? '📎 File'
              : 'Message'),
        messageType: sendMessageDto.messageType || 'text',
        attachments: sendMessageDto.attachments || [],
      };

      this.logger.log(`Creating message with data:`, messageData);

      const message = new this.chatMessageModel(messageData);
      const savedMessage = await message.save();

      this.logger.log(`✅ Message saved: ${savedMessage._id}`);

      // Update chat room
      const updateData: any = {
        lastMessageId: savedMessage._id,
        lastActivity: new Date(),
      };

      if (senderType === 'patient') {
        updateData.unreadCountDoctor = (chatRoom.unreadCountDoctor || 0) + 1;
      } else {
        updateData.unreadCountPatient = (chatRoom.unreadCountPatient || 0) + 1;
      }

      await this.chatRoomModel.findByIdAndUpdate(chatRoomId, updateData);
      this.logger.log(`✅ Chat room updated with unread counts`);

      // Populate sender info
      const populatedMessage = await this.chatMessageModel
        .findById(savedMessage._id)
        .populate('senderId', 'fullName avatarUrl')
        .exec();

      this.logger.log(`📤 Populated message:`, populatedMessage);

      // Send real-time notification to recipient
      const recipientId =
        senderType === 'patient'
          ? chatRoom.doctorId.toString()
          : chatRoom.patientId.toString();

      this.logger.log(
        `📤 Sending real-time notification to user: ${recipientId}`,
      );

      // Send to specific user
      this.chatGateway.sendMessageToUser(recipientId, 'new_message', {
        chatRoomId,
        message: populatedMessage,
        unreadCount:
          senderType === 'patient'
            ? updateData.unreadCountDoctor
            : updateData.unreadCountPatient,
      });

      // Also send to room (for all participants)
      this.logger.log(`📤 Broadcasting to room: ${chatRoomId}`);
      this.chatGateway.sendMessageToRoom(chatRoomId, 'room_new_message', {
        message: populatedMessage,
        sender: {
          id: senderId,
          type: senderType,
        },
      });

      // Send back to sender as confirmation
      this.chatGateway.sendMessageToUser(senderId, 'message_sent', {
        chatRoomId,
        message: populatedMessage,
        status: 'delivered',
      });

      this.logger.log(
        `✅ Message sent successfully with real-time notifications`,
      );
      return populatedMessage;
    } catch (error) {
      this.logger.error(`❌ Error sending message: ${error.message}`);
      this.logger.error(`Error stack: ${error.stack}`);
      throw error;
    }
  }

  async getChatRooms(userId: string, userType: 'patient' | 'doctor') {
    const filter: any = { status: { $ne: 'archived' } };

    if (userType === 'patient') {
      filter.patientId = new Types.ObjectId(userId);
    } else {
      filter.doctorId = new Types.ObjectId(userId);
    }

    return this.chatRoomModel
      .find(filter)
      .populate('patientId', 'fullName avatarUrl')
      .populate('doctorId', 'fullName avatarUrl photoUrl')
      .populate('lastMessageId')
      .sort({ lastActivity: -1 })
      .exec();
  }

  async getChatMessages(
    chatRoomId: string,
    userId: string,
    userType: 'patient' | 'doctor',
    page: number = 1,
    limit: number = 50,
  ) {
    // Validate access
    await this.validateUserAccess(chatRoomId, userId, userType);

    const skip = (page - 1) * limit;

    const messages = await this.chatMessageModel
      .find({ chatRoomId: new Types.ObjectId(chatRoomId) })
      .populate('senderId', 'fullName avatarUrl')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    return messages.reverse(); // Return in chronological order
  }

  async markMessagesAsRead(
    chatRoomId: string,
    userId: string,
    userType: 'patient' | 'doctor',
  ) {
    // Validate access
    await this.validateUserAccess(chatRoomId, userId, userType);

    // Mark messages as read
    await this.chatMessageModel.updateMany(
      {
        chatRoomId: new Types.ObjectId(chatRoomId),
        senderId: { $ne: new Types.ObjectId(userId) },
        isRead: false,
      },
      {
        isRead: true,
        readAt: new Date(),
      },
    );

    // Reset unread count
    const updateData =
      userType === 'patient'
        ? { unreadCountPatient: 0 }
        : { unreadCountDoctor: 0 };

    await this.chatRoomModel.findByIdAndUpdate(chatRoomId, updateData);

    return { success: true };
  }

  private async validateUserAccess(
    chatRoomId: string,
    userId: string,
    userType: 'patient' | 'doctor',
  ) {
    try {
      this.logger.log(
        `🔐 Validating user access - Room: ${chatRoomId}, User: ${userId} (${userType})`,
      );

      const chatRoom = await this.chatRoomModel.findById(chatRoomId).exec();

      if (!chatRoom) {
        this.logger.error(`❌ Chat room not found: ${chatRoomId}`);
        throw new NotFoundException('Chat room not found');
      }

      const hasAccess =
        userType === 'patient'
          ? chatRoom.patientId.toString() === userId
          : chatRoom.doctorId.toString() === userId;

      if (!hasAccess) {
        this.logger.error(
          `❌ Access denied for user ${userId} to room ${chatRoomId}`,
        );
        throw new ForbiddenException('Access denied to this chat room');
      }

      this.logger.log(`✅ User access validated successfully`);
      return chatRoom;
    } catch (error) {
      this.logger.error(`❌ Error validating user access: ${error.message}`);
      throw error;
    }
  }

  async getChatRoom(chatRoomId: string) {
    const chatRoom = await this.chatRoomModel
      .findById(chatRoomId)
      .populate('patientId', 'fullName avatarUrl')
      .populate('doctorId', 'fullName avatarUrl photoUrl')
      .populate('appointmentId')
      .exec();

    if (!chatRoom) {
      throw new NotFoundException('Chat room not found');
    }

    return chatRoom;
  }
}
