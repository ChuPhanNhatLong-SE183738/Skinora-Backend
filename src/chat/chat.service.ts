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

  // Add overloaded sendMessage methods to support different call signatures
  async sendMessage(
    chatRoomId: string,
    senderId: string,
    messageText: string,
    messageType?: 'text' | 'image' | 'file',
    fileUrl?: string,
  ): Promise<Message>;

  async sendMessage(
    chatRoomId: string,
    senderId: string,
    senderType: 'patient' | 'doctor',
    sendMessageDto: SendMessageDto,
  ): Promise<{ success: boolean; message: string; data: Message }>;

  async sendMessage(
    userId: string,
    senderType: 'patient' | 'doctor',
    sendMessageDto: SendMessageDto,
  ): Promise<{ success: boolean; message: string; data: Message }>;

  async sendMessage(
    arg1: string,
    arg2: string | 'patient' | 'doctor',
    arg3?: string | 'patient' | 'doctor' | SendMessageDto,
    arg4?: 'text' | 'image' | 'file' | SendMessageDto,
    arg5?: string,
  ): Promise<Message | { success: boolean; message: string; data: Message }> {
    this.logger.log(`🔍 sendMessage called with args:`, {
      arg1Type: typeof arg1,
      arg1Value: arg1,
      arg2Type: typeof arg2,
      arg2Value: arg2,
      arg3Type: typeof arg3,
      arg3HasContent:
        arg3 && typeof arg3 === 'object' ? 'content' in arg3 : false,
      arg4Type: typeof arg4,
      arg5Type: typeof arg5,
    });

    // Handle different method signatures
    if (
      typeof arg3 === 'string' &&
      (arg4 === undefined ||
        typeof arg4 === 'string' ||
        ['text', 'image', 'file'].includes(arg4 as any))
    ) {
      // Original signature: sendMessage(chatRoomId, senderId, messageText, messageType?, fileUrl?)
      this.logger.log(
        `📝 Using signature: sendMessage(chatRoomId, senderId, messageText, messageType?, fileUrl?)`,
      );
      return this.sendMessageInternal(
        arg1,
        arg2,
        arg3,
        (arg4 as 'text' | 'image' | 'file') || 'text',
        arg5,
      );
    } else if (typeof arg3 === 'object' && arg3 !== null && 'content' in arg3) {
      this.logger.log(`📝 Using signature: sendMessage with DTO object`);

      const sendMessageDto = arg3 as SendMessageDto;

      // Check if arg2 is senderType (patient/doctor) or userId
      if (typeof arg2 === 'string' && ['patient', 'doctor'].includes(arg2)) {
        this.logger.log(`📝 Detected senderType in arg2: ${arg2}`);
        const chatRoomId =
          sendMessageDto.chatRoomId || sendMessageDto.roomId || arg1;
        const senderId = sendMessageDto.senderId;

        if (!chatRoomId || !senderId) {
          throw new BadRequestException(
            'Chat room ID and sender ID are required',
          );
        }

        // Extract Cloudinary data if present
        const processedData = this.extractCloudinaryData(sendMessageDto);

        const message = await this.sendMessageInternal(
          chatRoomId,
          senderId,
          sendMessageDto.content,
          sendMessageDto.messageType || 'text',
          processedData.fileUrl,
          processedData.fileName,
          processedData.fileSize,
          processedData.mimeType,
          processedData.attachments,
        );
        return {
          success: true,
          message: 'Message sent successfully',
          data: message,
        };
      } else {
        this.logger.log(`📝 Detected userId in arg2: ${arg2}`);
        // Case: sendMessage(roomId, userId, sendMessageDto) - from controller
        const roomId = arg1;
        const userId = arg2;

        // Extract Cloudinary data if present
        const processedData = this.extractCloudinaryData(sendMessageDto);

        const message = await this.sendMessageInternal(
          roomId,
          userId,
          sendMessageDto.content,
          sendMessageDto.messageType || 'text',
          processedData.fileUrl,
          processedData.fileName,
          processedData.fileSize,
          processedData.mimeType,
          processedData.attachments,
        );
        return {
          success: true,
          message: 'Message sent successfully',
          data: message,
        };
      }
    } else if (
      typeof arg2 === 'string' &&
      ['patient', 'doctor'].includes(arg2) &&
      typeof arg3 === 'object'
    ) {
      this.logger.log(
        `📝 Using signature: sendMessage(userId, senderType, sendMessageDto)`,
      );
      const sendMessageDto = arg3 as SendMessageDto;
      const chatRoomId = sendMessageDto.chatRoomId || sendMessageDto.roomId;

      if (!chatRoomId) {
        throw new BadRequestException('Chat room ID is required');
      }

      // Set senderId from parameter if not already set in DTO
      if (!sendMessageDto.senderId) {
        sendMessageDto.senderId = arg1; // userId from JWT token
      }

      // Set senderType from parameter if not already set in DTO
      if (!sendMessageDto.senderType) {
        sendMessageDto.senderType = arg2 as 'patient' | 'doctor';
      }

      // Extract Cloudinary data if present
      const processedData = this.extractCloudinaryData(sendMessageDto);

      const message = await this.sendMessageInternal(
        chatRoomId,
        sendMessageDto.senderId, // Use the senderId (from JWT or DTO)
        sendMessageDto.content,
        sendMessageDto.messageType || 'text',
        processedData.fileUrl,
        processedData.fileName,
        processedData.fileSize,
        processedData.mimeType,
        processedData.attachments,
      );

      return {
        success: true,
        message: 'Message sent successfully',
        data: message,
      };
    }

    this.logger.error(`❌ No matching signature found for sendMessage`);
    throw new BadRequestException('Invalid arguments provided to sendMessage');
  }

  // Make sendMessageInternal public and add better parameter validation
  async sendMessageInternal(
    chatRoomId: string,
    senderId: string,
    messageText: string,
    messageType: 'text' | 'image' | 'file' = 'text',
    fileUrl?: string,
    fileName?: string,
    fileSize?: number,
    mimeType?: string,
    attachments?: string[],
  ): Promise<Message> {
    this.logger.log(`📝 sendMessageInternal called with:`, {
      chatRoomId,
      senderId,
      messageText,
      messageType,
      fileUrl: fileUrl || 'NOT_PROVIDED',
      fileName: fileName || 'NOT_PROVIDED',
      fileSize: fileSize || 'NOT_PROVIDED',
      mimeType: mimeType || 'NOT_PROVIDED',
      attachments: attachments || 'NOT_PROVIDED',
    });

    // Validate required parameters MORE STRICTLY
    if (!chatRoomId || chatRoomId === 'undefined' || chatRoomId === 'null') {
      this.logger.error(`❌ Invalid chatRoomId: ${chatRoomId}`);
      throw new BadRequestException('Valid chat room ID is required');
    }

    if (!senderId || senderId === 'undefined' || senderId === 'null') {
      this.logger.error(`❌ Invalid senderId: ${senderId}`);
      throw new BadRequestException('Valid sender ID is required');
    }

    if (!messageText || messageText.trim() === '') {
      this.logger.error(`❌ Invalid messageText: ${messageText}`);
      throw new BadRequestException('Message text is required');
    }

    // Validate ObjectId format
    if (!Types.ObjectId.isValid(chatRoomId)) {
      this.logger.error(`❌ Invalid chatRoomId format: ${chatRoomId}`);
      throw new BadRequestException('Invalid chat room ID format');
    }
    if (!Types.ObjectId.isValid(senderId)) {
      this.logger.error(`❌ Invalid senderId format: ${senderId}`);
      throw new BadRequestException('Invalid sender ID format');
    }

    // Validate chat room exists
    const chatRoom = await this.chatRoomModel.findById(chatRoomId).exec();
    if (!chatRoom) {
      throw new NotFoundException('Chat room not found');
    }

    // Verify sender has access to this chat room
    const isPatientInRoom = chatRoom.patientId.toString() === senderId;
    const isDoctorInRoom = chatRoom.doctorId.toString() === senderId;

    if (!isPatientInRoom && !isDoctorInRoom) {
      this.logger.error(
        `❌ Sender ${senderId} not in room ${chatRoomId}. PatientId: ${chatRoom.patientId}, DoctorId: ${chatRoom.doctorId}`,
      );
      throw new BadRequestException(
        'Sender is not a participant in this chat room',
      );
    }

    // Create message data with EXPLICIT validation
    const now = new Date();
    const senderObjectId = new Types.ObjectId(senderId);

    // Double-check the ObjectId conversion
    if (!senderObjectId) {
      this.logger.error(
        `❌ Failed to create ObjectId from senderId: ${senderId}`,
      );
      throw new BadRequestException('Failed to process sender ID');
    }

    const messageData: any = {
      chatRoomId: new Types.ObjectId(chatRoomId),
      senderId: senderObjectId, // Use the validated ObjectId
      messageText: messageText.trim(),
      messageType,
      timestamp: now,
      createdAt: now,
      updatedAt: now,
      isRead: false,
    };

    // Validate messageData before saving
    if (!messageData.senderId) {
      this.logger.error(
        `❌ messageData.senderId is null! Original senderId: ${senderId}`,
      );
      throw new BadRequestException('Failed to set sender ID in message data');
    }

    // Add file information with proper type checks
    if (fileUrl && fileUrl.trim() !== '') {
      messageData.fileUrl = fileUrl;
      this.logger.log(`📎 Added fileUrl: ${fileUrl}`);
    }
    if (fileName && fileName.trim() !== '') {
      messageData.fileName = fileName;
      this.logger.log(`📎 Added fileName: ${fileName}`);
    }
    if (fileSize && typeof fileSize === 'number' && fileSize > 0) {
      messageData.fileSize = fileSize;
      this.logger.log(`📎 Added fileSize: ${fileSize}`);
    }
    if (mimeType && mimeType.trim() !== '') {
      messageData.mimeType = mimeType;
      this.logger.log(`📎 Added mimeType: ${mimeType}`);
    }
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      messageData.attachments = attachments;
      this.logger.log(`📎 Added attachments:`, attachments);
    }

    this.logger.log(`📝 Final messageData before save:`, {
      ...messageData,
      senderId: messageData.senderId.toString(), // Log as string for readability
    });

    // Create and save message to database
    const message = new this.messageModel(messageData);
    const savedMessage = await message.save();

    // Verify the saved message has senderId
    if (!savedMessage.senderId) {
      this.logger.error(
        `❌ CRITICAL: Saved message has null senderId! Message ID: ${savedMessage._id}`,
      );
      throw new Error(
        'Message was saved with null senderId - this should not happen',
      );
    }

    this.logger.log(`💾 Message saved successfully with senderId:`, {
      id: (savedMessage as any)._id,
      senderId: savedMessage.senderId.toString(),
      messageText: savedMessage.messageText,
    });

    // Populate sender info for real-time sending - try multiple collections
    let populatedMessage = await this.messageModel
      .findById(savedMessage._id)
      .populate('senderId', 'fullName avatarUrl photoUrl')
      .exec();

    // If population failed, try to find user manually and attach info
    if (
      !populatedMessage?.senderId ||
      typeof populatedMessage.senderId === 'string'
    ) {
      this.logger.warn(
        `⚠️ Failed to populate senderId from default collection, trying alternatives`,
      );

      // Try to find user in different collections - prioritize doctors collection
      const userCollections = [
        'doctors', // Try doctors first since you have doctor data
        'users',
        'patients',
        'User',
        'Doctor',
      ];
      let userInfo: any = null;

      for (const collectionName of userCollections) {
        try {
          userInfo = await this.messageModel.db
            .collection(collectionName)
            .findOne({ _id: new Types.ObjectId(senderId) });

          if (userInfo) {
            this.logger.log(`✅ Found user in collection: ${collectionName}`);
            break;
          }
        } catch (error) {
          this.logger.warn(
            `⚠️ Failed to check collection ${collectionName}:`,
            error.message,
          );
        }
      }

      // Get the message without population and manually attach user info
      populatedMessage = await this.messageModel
        .findById(savedMessage._id)
        .exec();

      if (userInfo) {
        // Manually attach user info - handle both user and doctor fields
        (populatedMessage as any).senderId = {
          _id: userInfo._id,
          fullName: userInfo.fullName || userInfo.name || 'Unknown User',
          avatarUrl: userInfo.avatarUrl || userInfo.photoUrl || null,
        };
      } else {
        this.logger.error(`❌ Could not find user with ID: ${senderId}`);
        // Set a fallback sender info to ensure senderId is not null
        (populatedMessage as any).senderId = {
          _id: senderId,
          fullName: 'Unknown User',
          avatarUrl: null,
        };
      }
    }

    if (!populatedMessage) {
      throw new Error('Failed to retrieve saved message');
    }

    // Update chat room's last message and timestamp
    await this.chatRoomModel.findByIdAndUpdate(chatRoomId, {
      lastMessage: messageText.substring(0, 100),
      lastMessageId: savedMessage._id,
      lastMessageTime: now,
      updatedAt: now,
    });

    // Send real-time message via WebSocket
    try {
      if (this.chatGateway) {
        const messageData = {
          _id: (populatedMessage as any)._id,
          chatRoomId: chatRoomId,
          senderId: populatedMessage.senderId,
          messageText: populatedMessage.messageText,
          messageType: populatedMessage.messageType,
          fileUrl: populatedMessage.fileUrl,
          fileName: populatedMessage.fileName,
          fileSize: populatedMessage.fileSize,
          mimeType: populatedMessage.mimeType,
          attachments: populatedMessage.attachments,
          timestamp: populatedMessage.timestamp.toISOString(),
          isRead: populatedMessage.isRead,
        };

        this.chatGateway.sendToRoom(chatRoomId, 'new_message', messageData);

        const participants = [chatRoom.patientId, chatRoom.doctorId];
        for (const participantId of participants) {
          if (participantId.toString() !== senderId) {
            this.chatGateway.sendToUser(
              participantId.toString(),
              'message_received',
              messageData,
            );
          }
        }

        this.logger.log(
          `📨 Real-time message sent to room ${chatRoomId} and participants`,
        );
      }
    } catch (error) {
      this.logger.error(
        `❌ Failed to send real-time message: ${error.message}`,
      );
    }

    return populatedMessage;
  }

  async getChatRooms(
    userId: string,
    userType: 'patient' | 'doctor' = 'patient',
  ): Promise<ChatRoom[]> {
    const query =
      userType === 'patient'
        ? { patientId: new Types.ObjectId(userId) }
        : { doctorId: new Types.ObjectId(userId) };

    return this.chatRoomModel
      .find(query)
      .populate('patientId', 'fullName avatarUrl')
      .populate('doctorId', 'fullName photoUrl')
      .populate('appointmentId', 'startTime endTime appointmentStatus')
      .sort({ lastMessageTime: -1 })
      .exec();
  }

  async getChatRoom(roomId: string): Promise<ChatRoom> {
    const chatRoom = await this.chatRoomModel
      .findById(roomId)
      .populate('patientId', 'fullName avatarUrl')
      .populate('doctorId', 'fullName photoUrl')
      .populate('appointmentId', 'startTime endTime appointmentStatus')
      .exec();

    if (!chatRoom) {
      throw new NotFoundException('Chat room not found');
    }

    return chatRoom;
  }

  async getMessages(
    chatRoomId: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<Message[]> {
    this.logger.log(
      `🔍 Getting messages for chatRoomId: ${chatRoomId}, page: ${page}, limit: ${limit}`,
    );

    // Validate chatRoomId format
    if (!Types.ObjectId.isValid(chatRoomId)) {
      this.logger.error(`❌ Invalid chatRoomId format: ${chatRoomId}`);
      throw new BadRequestException('Invalid chat room ID format');
    }

    const chatRoom = await this.chatRoomModel.findById(chatRoomId).exec();
    if (!chatRoom) {
      this.logger.error(`❌ Chat room not found: ${chatRoomId}`);
      throw new NotFoundException('Chat room not found');
    }

    // Calculate skip value
    const skip = (page - 1) * limit;
    this.logger.log(`📊 Calculated skip: ${skip}, limit: ${limit}`);

    // Get messages with pagination - use lean() for better performance
    const messages = await this.messageModel
      .find({ chatRoomId: new Types.ObjectId(chatRoomId) })
      .sort({ timestamp: -1 }) // Latest first
      .limit(limit)
      .skip(skip)
      .lean()
      .exec();

    this.logger.log(`📨 Found ${messages.length} messages after pagination`);

    // Process messages and handle cases where senderId exists but population failed
    const processedMessages = await Promise.all(
      messages.map(async (message: any) => {
        let senderInfo: any = null;

        // Debug: Log the raw senderId from database
        this.logger.log(`🔍 Processing message ${message._id}:`, {
          messageId: message._id,
          rawSenderId: message.senderId,
          senderIdType: typeof message.senderId,
        });

        if (message.senderId) {
          const senderId = message.senderId.toString();

          // Try to find user manually in different collections - prioritize doctors
          const userCollections = [
            'doctors', // Try doctors first
            'users',
            'patients',
            'User',
            'Doctor',
          ];

          let userFound = false;
          for (const collectionName of userCollections) {
            try {
              const userInfo: any = await this.messageModel.db
                .collection(collectionName)
                .findOne({ _id: new Types.ObjectId(senderId) });

              if (userInfo) {
                this.logger.log(
                  `✅ Found user in collection: ${collectionName} for senderId: ${senderId}`,
                );
                senderInfo = {
                  _id: userInfo._id,
                  fullName:
                    userInfo.fullName || userInfo.name || 'Unknown User',
                  avatarUrl: userInfo.avatarUrl || userInfo.photoUrl || null,
                };
                userFound = true;
                break;
              }
            } catch (error) {
              this.logger.warn(
                `⚠️ Error checking collection ${collectionName}:`,
                error.message,
              );
            }
          }

          // If still no user info found, set fallback
          if (!userFound) {
            this.logger.warn(
              `❌ Could not find user data for senderId: ${senderId}`,
            );
            senderInfo = {
              _id: senderId,
              fullName: 'Unknown User',
              avatarUrl: null,
            };
          }
        } else {
          // Truly null senderId in database
          this.logger.error(
            `❌ Message ${message._id} has NULL senderId in database - this indicates a data integrity issue`,
          );
          senderInfo = {
            _id: null,
            fullName: 'System Message',
            avatarUrl: null,
          };
        }

        return {
          ...message,
          senderId: senderInfo,
          timestamp: new Date(message.timestamp).toISOString(),
          createdAt: new Date(message.createdAt).toISOString(),
          updatedAt: new Date(message.updatedAt).toISOString(),
          readAt: message.readAt
            ? new Date(message.readAt).toISOString()
            : undefined,
        };
      }),
    );

    // Return in chronological order (oldest first)
    const orderedMessages = processedMessages.reverse();

    this.logger.log(
      `📨 Returning ${orderedMessages.length} messages in chronological order`,
    );

    return orderedMessages as any[];
  }

  async markMessagesAsRead(chatRoomId: string, userId: string): Promise<void> {
    await this.messageModel.updateMany(
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

  // Add helper method to check if user exists
  private async checkUserExists(userId: string): Promise<boolean> {
    try {
      // Check different possible user collections - prioritize doctors
      const collections = ['doctors', 'users', 'patients', 'User', 'Doctor'];
      for (const collectionName of collections) {
        try {
          const count = await this.messageModel.db
            .collection(collectionName)
            .countDocuments({ _id: new Types.ObjectId(userId) });
          if (count > 0) {
            this.logger.log(
              `✅ User ${userId} found in collection: ${collectionName}`,
            );
            return true;
          }
        } catch (error) {
          this.logger.warn(
            `⚠️ Collection ${collectionName} not found or error: ${error.message}`,
          );
        }
      }
      this.logger.warn(`❌ User ${userId} not found in any user collection`);
      return false;
    } catch (error) {
      this.logger.error(`❌ Error checking user existence: ${error.message}`);
      return false;
    }
  }

  /**
   * Extract Cloudinary data from SendMessageDto
   */
  private extractCloudinaryData(sendMessageDto: SendMessageDto): {
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    attachments?: string[];
  } {
    const result: {
      fileUrl?: string;
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
      attachments?: string[];
    } = {};

    // Priority: Cloudinary secure_url > fileUrl
    if (sendMessageDto.secure_url) {
      result.fileUrl = sendMessageDto.secure_url;
    } else if (sendMessageDto.fileUrl) {
      result.fileUrl = sendMessageDto.fileUrl;
    }

    // Extract file metadata
    if (sendMessageDto.originalName || sendMessageDto.fileName) {
      result.fileName = sendMessageDto.originalName || sendMessageDto.fileName;
    }

    if (sendMessageDto.bytes || sendMessageDto.fileSize) {
      result.fileSize = sendMessageDto.bytes || sendMessageDto.fileSize;
    }

    if (sendMessageDto.format && sendMessageDto.format.trim() !== '') {
      // Convert format to MIME type
      result.mimeType = this.formatToMimeType(sendMessageDto.format);
    } else if (sendMessageDto.mimeType) {
      result.mimeType = sendMessageDto.mimeType;
    }

    // Handle attachments
    if (sendMessageDto.attachments && sendMessageDto.attachments.length > 0) {
      result.attachments = sendMessageDto.attachments;
    } else if (result.fileUrl) {
      // If we have a single file URL, add it to attachments array
      result.attachments = [result.fileUrl];
    }

    this.logger.log(`📎 Extracted Cloudinary data:`, result);
    return result;
  }

  /**
   * Convert file format to MIME type
   */
  private formatToMimeType(format: string): string {
    const mimeTypes: { [key: string]: string } = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      bmp: 'image/bmp',
      svg: 'image/svg+xml',
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      txt: 'text/plain',
    };

    return mimeTypes[format.toLowerCase()] || `application/${format}`;
  }
}
