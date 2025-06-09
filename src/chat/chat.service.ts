import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateChatRoomDto } from './dto/create-chat-room.dto';
import { SendMessageDto, CreateMessageDto } from './dto/send-message.dto';
import { ChatRoom, ChatRoomDocument } from './entities/chat-room.entity';
import { Message, MessageDocument } from './entities/message.entity';
import { ChatGateway } from './chat.gateway';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectModel(ChatRoom.name)
    private chatRoomModel: Model<ChatRoomDocument>,
    @InjectModel(Message.name)
    private messageModel: Model<MessageDocument>,
    private chatGateway?: ChatGateway,
  ) {}

  async createChatRoom(createChatRoomDto: CreateChatRoomDto) {
    // Check if chat room already exists between patient and doctor
    const existingRoom = await this.chatRoomModel
      .findOne({
        patientId: new Types.ObjectId(createChatRoomDto.patientId),
        doctorId: new Types.ObjectId(createChatRoomDto.doctorId),
      })
      .exec();

    if (existingRoom) {
      return existingRoom;
    }

    const newChatRoom = new this.chatRoomModel({
      patientId: new Types.ObjectId(createChatRoomDto.patientId),
      doctorId: new Types.ObjectId(createChatRoomDto.doctorId),
      appointmentId: createChatRoomDto.appointmentId
        ? new Types.ObjectId(createChatRoomDto.appointmentId)
        : undefined,
      createdAt: new Date(),
      lastActivity: new Date(),
    });

    return await newChatRoom.save();
  }

  async sendMessage(
    userIdOrRoomId: string,
    senderTypeOrUserId: 'patient' | 'doctor' | string,
    sendMessageDtoOrSenderType?: SendMessageDto | 'patient' | 'doctor',
    sendMessageDtoFinal?: SendMessageDto,
  ) {
    // Handle different call signatures
    let userId: string;
    let senderType: 'patient' | 'doctor';
    let sendMessageDto: SendMessageDto;
    let roomId: string;

    if (sendMessageDtoFinal) {
      // 4 parameter call: (roomId, userId, senderType, sendMessageDto)
      roomId = userIdOrRoomId;
      userId = senderTypeOrUserId as string;
      senderType = sendMessageDtoOrSenderType as 'patient' | 'doctor';
      sendMessageDto = sendMessageDtoFinal;
    } else {
      // 3 parameter call: (userId, senderType, sendMessageDto)
      userId = userIdOrRoomId;
      senderType = senderTypeOrUserId as 'patient' | 'doctor';
      sendMessageDto = sendMessageDtoOrSenderType as SendMessageDto;
      roomId = sendMessageDto.roomId || '';

      // Validate roomId is provided in 3-parameter call
      if (!roomId) {
        throw new BadRequestException('roomId is required in message payload');
      }
    }

    // CRITICAL DEBUG: Log every step of userId extraction
    this.logger.log(`🔍 [CRITICAL DEBUG] sendMessage parameters:`, {
      step: 'PARAMETER_EXTRACTION',
      userIdOrRoomId,
      senderTypeOrUserId,
      sendMessageDtoOrSenderType,
      sendMessageDtoFinal,
      extractedUserId: userId,
      extractedUserIdType: typeof userId,
      extractedUserIdLength: userId?.length,
      extractedRoomId: roomId,
      extractedSenderType: senderType,
    });

    // Validate all required parameters with detailed logging
    if (!userId || userId === 'undefined' || userId === 'null') {
      this.logger.error(`❌ [CRITICAL] Invalid userId detected:`, {
        userId,
        userIdType: typeof userId,
        userIdStringified: JSON.stringify(userId),
        originalParams: { userIdOrRoomId, senderTypeOrUserId },
      });
      throw new BadRequestException(`Valid userId is required. Got: ${userId}`);
    }

    if (!roomId || roomId === 'undefined' || roomId === 'null') {
      this.logger.error(`❌ [CRITICAL] Invalid roomId detected:`, {
        roomId,
        roomIdType: typeof roomId,
        roomIdStringified: JSON.stringify(roomId),
      });
      throw new BadRequestException(`Valid roomId is required. Got: ${roomId}`);
    }

    // Enhanced ObjectId validation with detailed logging
    this.logger.log(`🔍 [CRITICAL DEBUG] ObjectId validation:`, {
      userId,
      userIdIsValidObjectId: Types.ObjectId.isValid(userId),
      roomId,
      roomIdIsValidObjectId: Types.ObjectId.isValid(roomId),
    });

    if (!Types.ObjectId.isValid(userId)) {
      this.logger.error(`❌ [CRITICAL] Invalid userId ObjectId format:`, {
        userId,
        userIdType: typeof userId,
        userIdLength: userId?.length,
      });
      throw new BadRequestException(`Invalid userId format: ${userId}`);
    }

    if (!Types.ObjectId.isValid(roomId)) {
      this.logger.error(`❌ [CRITICAL] Invalid roomId ObjectId format:`, {
        roomId,
        roomIdType: typeof roomId,
        roomIdLength: roomId?.length,
      });
      throw new BadRequestException(`Invalid roomId format: ${roomId}`);
    }

    try {
      await this.validateChatRoomAccess(roomId, userId, senderType);

      this.logger.log(`✅ [DEBUG] Chat room access validated`);

      // Create ObjectId instances with detailed logging
      this.logger.log(`🔍 [CRITICAL DEBUG] Creating ObjectIds:`, {
        userIdString: userId,
        roomIdString: roomId,
      });

      const roomObjectId = new Types.ObjectId(roomId);
      const userObjectId = new Types.ObjectId(userId);

      this.logger.log(`✅ [CRITICAL DEBUG] ObjectIds created successfully:`, {
        roomObjectId: roomObjectId.toString(),
        userObjectId: userObjectId.toString(),
        userObjectIdIsValid: userObjectId instanceof Types.ObjectId,
      });

      // Create message data with explicit validation
      const messageData = {
        chatRoomId: roomObjectId,
        senderId: userObjectId, // This should NOT be null
        senderType: senderType,
        content: sendMessageDto.content,
        messageType: sendMessageDto.messageType || 'text',
        fileUrl: sendMessageDto.fileUrl,
        fileName: sendMessageDto.fileName,
        attachments: sendMessageDto.attachments || [],
        timestamp: new Date(),
        isRead: false,
      };

      this.logger.log(`📝 [CRITICAL DEBUG] Message data before save:`, {
        ...messageData,
        senderIdType: typeof messageData.senderId,
        senderIdIsObjectId: messageData.senderId instanceof Types.ObjectId,
        senderIdString: messageData.senderId.toString(),
        senderIdIsNull: messageData.senderId === null,
        senderIdIsUndefined: messageData.senderId === undefined,
      });

      // Validate senderId is not null before saving
      if (!messageData.senderId || messageData.senderId === null) {
        this.logger.error(`❌ [CRITICAL ERROR] senderId is null before save:`, {
          messageData,
          originalUserId: userId,
          userObjectId: userObjectId,
        });
        throw new BadRequestException('SenderId cannot be null');
      }

      const newMessage = new this.messageModel(messageData);

      this.logger.log(`📝 [CRITICAL DEBUG] Before save - Message model:`, {
        chatRoomId: newMessage.chatRoomId,
        senderId: newMessage.senderId,
        senderIdType: typeof newMessage.senderId,
        senderIdIsNull: newMessage.senderId === null,
        senderType: newMessage.senderType,
        content: newMessage.content,
      });

      const savedMessage = await newMessage.save();

      this.logger.log(`💾 [CRITICAL DEBUG] After save - Saved message:`, {
        id: savedMessage._id,
        chatRoomId: savedMessage.chatRoomId,
        senderId: savedMessage.senderId,
        senderIdType: typeof savedMessage.senderId,
        senderIdIsNull: savedMessage.senderId === null,
        senderIdString: savedMessage.senderId?.toString(),
        senderType: savedMessage.senderType,
        content: savedMessage.content,
      });

      // If senderId is still null after save, log critical error
      if (!savedMessage.senderId || savedMessage.senderId === null) {
        this.logger.error(
          `🚨 [CRITICAL ERROR] Message saved with null senderId!`,
          {
            messageId: savedMessage._id,
            originalUserId: userId,
            messageData,
            savedMessage: savedMessage.toObject(),
          },
        );
      }

      // Populate sender info for real-time broadcast
      const populatedMessage = await this.messageModel
        .findById(savedMessage._id)
        .populate('senderId', 'fullName avatarUrl role')
        .exec();

      this.logger.log(`🔍 [DEBUG] Populated message:`, {
        id: populatedMessage?._id,
        senderId: populatedMessage?.senderId,
        senderIdPopulated: populatedMessage?.senderId ? 'YES' : 'NO',
      });

      // Update chat room's last message and activity
      await this.chatRoomModel
        .findByIdAndUpdate(
          roomId,
          {
            lastMessage: savedMessage._id,
            lastActivity: new Date(),
            $inc: { messageCount: 1 },
          },
          { new: true },
        )
        .exec();

      this.logger.log(`📊 [DEBUG] Chat room updated with new message`);

      // Update room status based on sender type
      if (senderType === 'patient') {
        await this.chatRoomModel.findByIdAndUpdate(roomId, {
          patientActive: true,
        });
      } else {
        await this.chatRoomModel.findByIdAndUpdate(roomId, {
          doctorActive: true,
        });
      }

      // Broadcast message to WebSocket
      if (this.chatGateway) {
        await this.chatGateway.broadcastMessage(roomId, populatedMessage);
        this.logger.log(`📡 [DEBUG] Message broadcasted via WebSocket`);
      }

      // Send notification to sender
      await this.sendToUser(userId, 'message_sent', {
        chatRoomId: roomId,
        message: populatedMessage,
        timestamp: new Date(),
      });

      return {
        success: true,
        message: 'Message sent successfully',
        data: populatedMessage || savedMessage,
      };
    } catch (error) {
      this.logger.error(`❌ [ERROR] Failed to send message:`, {
        error: error.message,
        stack: error.stack,
        roomId,
        userId,
        senderType,
      });
      throw new BadRequestException(`Failed to send message: ${error.message}`);
    }
  }

  async getMessages(roomId: string, page: number = 1, limit: number = 50) {
    this.logger.log(
      `🔍 [DEBUG] getMessages called with roomId: ${roomId}, page: ${page}, limit: ${limit}`,
    );

    // Validate roomId format
    if (!Types.ObjectId.isValid(roomId)) {
      throw new BadRequestException(`Invalid roomId format: ${roomId}`);
    }

    const skip = (page - 1) * limit;

    try {
      // Query the "message" collection directly with detailed logging
      this.logger.log(
        `📊 [DEBUG] Querying messages collection for chatRoomId: ${roomId}`,
      );

      const messages = await this.messageModel
        .find({ chatRoomId: new Types.ObjectId(roomId) })
        .populate('senderId', 'fullName avatarUrl role email')
        .sort({ timestamp: 1 }) // Oldest messages first, newest at bottom
        .skip(skip)
        .limit(limit)
        .exec();

      this.logger.log(
        `✅ [DEBUG] Found ${messages.length} messages in database`,
      );

      // Log sample message for debugging
      if (messages.length > 0) {
        this.logger.log(`📄 [DEBUG] Sample message:`, {
          id: messages[0]._id,
          content: messages[0].content,
          senderId: messages[0].senderId,
          senderType: messages[0].senderType,
          timestamp: messages[0].timestamp,
        });
      }

      return messages;
    } catch (error) {
      this.logger.error(`❌ [ERROR] Failed to get messages:`, {
        error: error.message,
        roomId,
        page,
        limit,
      });
      throw new BadRequestException(`Failed to get messages: ${error.message}`);
    }
  }

  async getChatRooms(userId: string, userType: 'patient' | 'doctor') {
    const query =
      userType === 'patient'
        ? { patientId: new Types.ObjectId(userId) }
        : { doctorId: new Types.ObjectId(userId) };

    return await this.chatRoomModel
      .find(query)
      .populate('patientId', 'fullName avatarUrl')
      .populate('doctorId', 'fullName photoUrl')
      .populate('lastMessage')
      .sort({ lastActivity: -1 })
      .exec();
  }

  async getChatRoom(chatRoomId: string) {
    return await this.chatRoomModel
      .findById(chatRoomId)
      .populate('patientId', 'fullName avatarUrl')
      .populate('doctorId', 'fullName photoUrl')
      .populate('lastMessage')
      .exec();
  }

  // Update markMessagesAsRead to accept userType parameter
  async markMessagesAsRead(
    roomId: string,
    userId: string,
    userType?: 'patient' | 'doctor',
  ) {
    // Validate access if userType is provided
    if (userType) {
      await this.validateChatRoomAccess(roomId, userId, userType);
    }

    await this.messageModel.updateMany(
      {
        chatRoomId: new Types.ObjectId(roomId),
        senderId: { $ne: new Types.ObjectId(userId) },
        isRead: false,
      },
      { isRead: true },
    );
  }

  private async validateChatRoomAccess(
    roomId: string,
    userId: string,
    userType: 'patient' | 'doctor',
  ): Promise<void> {
    // Validate inputs before using them
    if (!roomId || roomId === 'undefined') {
      throw new BadRequestException('Valid roomId is required for validation');
    }
    if (!userId || userId === 'undefined') {
      throw new BadRequestException('Valid userId is required for validation');
    }
    if (!userType) {
      throw new BadRequestException(
        'Valid userType is required for validation',
      );
    }

    // Validate ObjectId format
    if (!Types.ObjectId.isValid(roomId)) {
      throw new BadRequestException('Invalid roomId format');
    }
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid userId format');
    }

    const chatRoom = await this.chatRoomModel.findById(roomId).exec();

    if (!chatRoom) {
      throw new NotFoundException('Chat room not found');
    }

    const isPatientInRoom = chatRoom.patientId.toString() === userId;
    const isDoctorInRoom = chatRoom.doctorId.toString() === userId;

    if (!isPatientInRoom && !isDoctorInRoom) {
      throw new BadRequestException(
        'You are not authorized to access this chat room',
      );
    }

    if (userType === 'patient' && !isPatientInRoom) {
      throw new BadRequestException(
        'User type mismatch: not the patient in this room',
      );
    }

    if (userType === 'doctor' && !isDoctorInRoom) {
      throw new BadRequestException(
        'User type mismatch: not the doctor in this room',
      );
    }
  }

  private async sendToUser(userId: string, event: string, data: any) {
    if (this.chatGateway) {
      await this.chatGateway.sendToUser(userId, event, data);
    }
  }
}
