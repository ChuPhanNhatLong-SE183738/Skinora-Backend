import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CreateChatRoomDto } from './dto/create-chat-room.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../users/enums/role.enum';
import { Logger } from '@nestjs/common';
import { successResponse, errorResponse } from '../helper/response.helper';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { UploadFileDto } from './dto/upload-file.dto';

@ApiTags('chat')
@ApiBearerAuth()
@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Post('rooms')
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.DOCTOR, Role.ADMIN)
  @ApiOperation({
    summary: 'Create a new chat room between patient and doctor',
  })
  @ApiResponse({
    status: 201,
    description: 'Chat room created successfully',
    schema: {
      example: {
        success: true,
        message: 'Chat room created successfully',
        data: {
          _id: '676123abc...',
          patientId: '675abc123...',
          doctorId: '675def456...',
          status: 'active',
          lastActivity: '2025-01-06T12:00:00.000Z',
          unreadCountPatient: 0,
          unreadCountDoctor: 0,
        },
      },
    },
  })
  async createChatRoom(@Body() createChatRoomDto: CreateChatRoomDto) {
    try {
      this.logger.log(
        `📥 POST /chat/rooms - ${JSON.stringify(createChatRoomDto)}`,
      );

      const chatRoom = await this.chatService.createChatRoom(createChatRoomDto);

      this.logger.log(`✅ Chat room created successfully: ${chatRoom._id}`);
      return {
        success: true,
        message: 'Chat room created successfully',
        data: chatRoom,
      };
    } catch (error) {
      this.logger.error(`❌ Error creating chat room: ${error.message}`);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @Get('rooms')
  @ApiOperation({ summary: 'Get all chat rooms for current user' })
  @ApiResponse({
    status: 200,
    description: 'Chat rooms retrieved successfully',
    schema: {
      example: {
        success: true,
        message: 'Chat rooms retrieved successfully',
        data: [
          {
            _id: '676123abc...',
            patientId: {
              _id: '675abc123...',
              fullName: 'John Doe',
              avatarUrl: '...',
            },
            doctorId: {
              _id: '675def456...',
              fullName: 'Dr. Smith',
              photoUrl: '...',
            },
            lastMessageId: {
              content: 'Hello doctor',
              createdAt: '2025-01-06T12:00:00.000Z',
            },
            unreadCountPatient: 0,
            unreadCountDoctor: 2,
          },
        ],
      },
    },
  })
  async getChatRooms(@Request() req) {
    const userId = req.user.sub || req.user.id;
    const userType = req.user.role === 'doctor' ? 'doctor' : 'patient'; // <- Auto detect

    const chatRooms = await this.chatService.getChatRooms(userId, userType);
    return {
      success: true,
      message: 'Chat rooms retrieved successfully',
      data: chatRooms,
    };
  }

  @Get('rooms/:roomId')
  @ApiOperation({ summary: 'Get chat room details' })
  @ApiParam({ name: 'roomId', description: 'Chat room ID' })
  @ApiResponse({
    status: 200,
    description: 'Chat room details retrieved successfully',
  })
  async getChatRoom(@Param('roomId') roomId: string) {
    const chatRoom = await this.chatService.getChatRoom(roomId);
    return {
      success: true,
      message: 'Chat room details retrieved successfully',
      data: chatRoom,
    };
  }

  @Post('rooms/:roomId/messages')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send message to chat room' })
  @ApiResponse({
    status: 201,
    description: 'Message sent successfully',
    schema: {
      example: {
        success: true,
        message: 'Message sent successfully',
        data: {
          _id: '675ce123abc456def789',
          chatRoomId: '675ce123abc456def789',
          senderId: {
            _id: '675ce123abc456def789',
            fullName: 'Dr. Smith',
            avatarUrl: 'doctor-avatar.jpg',
          },
          senderType: 'doctor',
          content: 'Hello, how are you feeling today?',
          messageType: 'text',
          timestamp: '2025-01-06T10:30:00.000Z',
          isRead: false,
        },
      },
    },
  })
  async sendMessage(
    @Param('roomId') roomId: string,
    @Request() req,
    @Body() sendMessageDto: SendMessageDto,
  ) {
    try {
      const userId = req.user.sub || req.user.id;
      const senderType = req.user.role === 'doctor' ? 'doctor' : 'patient';

      // Enhanced debug logging
      this.logger.log(`🔍 [DEBUG] Controller sendMessage:`, {
        roomId,
        userId,
        userIdFromToken: req.user,
        senderType,
        messageContent: sendMessageDto.content,
        messageType: sendMessageDto.messageType,
      });

      // Validate required parameters
      if (!roomId || roomId === 'undefined') {
        throw new BadRequestException('Invalid roomId from URL parameter');
      }
      if (!userId || userId === 'undefined') {
        this.logger.error(`❌ Invalid userId from JWT token:`, req.user);
        throw new BadRequestException('Invalid userId from JWT token');
      }

      // Call with 4 parameters: (roomId, userId, senderType, sendMessageDto)
      const result = await this.chatService.sendMessage(
        roomId,
        userId,
        senderType,
        sendMessageDto,
      );

      return {
        success: true,
        message: 'Message sent successfully',
        data: result.data,
      };
    } catch (error) {
      this.logger.error(`❌ Error in sendMessage controller:`, {
        error: error.message,
        stack: error.stack,
        roomId,
        userId: req.user?.sub || req.user?.id,
        reqUser: req.user,
      });
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @Get('rooms/:roomId/messages')
  @ApiOperation({ summary: 'Get messages in chat room with pagination' })
  @ApiParam({ name: 'roomId', description: 'Chat room ID' })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Messages per page (default: 50)',
  })
  @ApiResponse({
    status: 200,
    description: 'Messages retrieved successfully',
    schema: {
      example: {
        success: true,
        message: 'Messages retrieved successfully',
        data: [
          {
            _id: '676789xyz...',
            senderId: {
              _id: '675abc123...',
              fullName: 'John Doe',
              avatarUrl: '...',
            },
            senderType: 'patient',
            content: 'Hello doctor',
            messageType: 'text',
            isRead: true,
            createdAt: '2025-01-06T12:00:00.000Z',
          },
        ],
      },
    },
  })
  async getChatMessages(
    @Param('roomId') roomId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
    @Request() req,
  ) {
    try {
      const userId = req.user.sub || req.user.id;
      const userType = req.user.role === 'doctor' ? 'doctor' : 'patient';

      this.logger.log(
        `🔍 [DEBUG] Getting messages for room: ${roomId}, user: ${userId}, type: ${userType}`,
      );

      // Call service method that queries the "message" collection directly
      const messages = await this.chatService.getMessages(
        roomId,
        +page,
        +limit,
      );

      this.logger.log(`📊 [DEBUG] Found ${messages.length} messages`);

      return {
        success: true,
        message: 'Messages retrieved successfully',
        data: messages,
      };
    } catch (error) {
      this.logger.error(`❌ Error getting messages: ${error.message}`);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @Patch('rooms/:roomId/read')
  @ApiOperation({ summary: 'Mark messages as read in chat room' })
  @ApiParam({ name: 'roomId', description: 'Chat room ID' })
  @ApiResponse({
    status: 200,
    description: 'Messages marked as read successfully',
    schema: {
      example: {
        success: true,
        message: 'Messages marked as read successfully',
      },
    },
  })
  async markMessagesAsRead(@Param('roomId') roomId: string, @Request() req) {
    const userId = req.user.sub || req.user.id;
    const userType = req.user.role === 'doctor' ? 'doctor' : 'patient';

    await this.chatService.markMessagesAsRead(roomId, userId, userType);

    return {
      success: true,
      message: 'Messages marked as read successfully',
    };
  }

  @Post('rooms/appointment/:appointmentId')
  @ApiOperation({ summary: 'Create chat room from appointment' })
  @ApiParam({
    name: 'appointmentId',
    description: 'Appointment ID to create chat from',
  })
  @ApiResponse({
    status: 201,
    description: 'Chat room created from appointment successfully',
  })
  async createChatFromAppointment(
    @Param('appointmentId') appointmentId: string,
    @Request() req,
  ) {
    // This would need to be implemented in the service
    // For now, return a placeholder response
    return {
      success: true,
      message: 'Feature coming soon - Create chat from appointment',
      data: { appointmentId },
    };
  }

  @Get('debug/status')
  @ApiOperation({ summary: 'Get chat system status for debugging' })
  async getDebugStatus() {
    try {
      // You can inject ChatGateway if needed
      return {
        success: true,
        message: 'Chat system status',
        data: {
          timestamp: new Date().toISOString(),
          // connectedUsers: this.chatGateway.getConnectedUsersCount(),
          // connectedUsersList: this.chatGateway.getConnectedUsers(),
        },
      };
    } catch (error) {
      this.logger.error(`❌ Error getting debug status: ${error.message}`);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @Post('rooms/:roomId/upload')
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      storage: diskStorage({
        destination: './uploads/chat',
        filename: (req, file, callback) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          callback(null, `chat-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        // Allow images and common file types
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt/;
        const extname = allowedTypes.test(file.originalname.toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
          return callback(null, true);
        } else {
          callback(new Error('Only images and documents are allowed!'), false);
        }
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
    }),
  )
  @ApiOperation({ summary: 'Upload files to chat room' })
  @ApiParam({ name: 'roomId', description: 'Chat room ID' })
  async uploadFiles(
    @Param('roomId') roomId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() uploadFileDto: UploadFileDto,
    @Request() req,
  ) {
    try {
      const userId = req.user.sub || req.user.id;
      const senderType = req.user.role === 'doctor' ? 'doctor' : 'patient';

      if (!files || files.length === 0) {
        return {
          success: false,
          message: 'No files uploaded',
        };
      }

      // Create file URLs
      const attachments = files.map(
        (file) =>
          `${req.protocol}://${req.get('host')}/uploads/chat/${file.filename}`,
      );

      // Determine message type and content
      const messageType =
        uploadFileDto.messageType ||
        (files.some((file) =>
          ['image/jpeg', 'image/png', 'image/gif'].includes(file.mimetype),
        )
          ? 'image'
          : 'file');

      const content =
        uploadFileDto.content ||
        (messageType === 'image' ? '📷 Shared an image' : '📎 Shared a file');

      const sendMessageDto: SendMessageDto = {
        roomId: roomId,
        senderId: userId,
        senderType: senderType,
        content,
        messageType: messageType as 'text' | 'image' | 'file',
        attachments,
      };

      const message = await this.chatService.sendMessage(
        roomId,
        userId,
        senderType,
        sendMessageDto,
      );

      return {
        success: true,
        message: 'Files uploaded and message sent successfully',
        data: {
          message,
          uploadedFiles: files.map((file) => ({
            originalName: file.originalname,
            filename: file.filename,
            size: file.size,
            url: `${req.protocol}://${req.get('host')}/uploads/chat/${file.filename}`,
          })),
        },
      };
    } catch (error) {
      this.logger.error(`❌ Error uploading files: ${error.message}`);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @Post('rooms/:roomId/upload-image')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: './uploads/chat/images',
        filename: (req, file, callback) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          callback(null, `img-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        // Only allow images
        if (file.mimetype.match(/\/(jpg|jpeg|png|gif)$/)) {
          callback(null, true);
        } else {
          callback(new Error('Only image files are allowed!'), false);
        }
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit for images
      },
    }),
  )
  @ApiOperation({ summary: 'Upload image to chat room' })
  @ApiParam({ name: 'roomId', description: 'Chat room ID' })
  async uploadImage(
    @Param('roomId') roomId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadFileDto: UploadFileDto,
    @Request() req,
  ) {
    try {
      const userId = req.user.sub || req.user.id;
      const senderType = req.user.role === 'doctor' ? 'doctor' : 'patient';

      if (!file) {
        return {
          success: false,
          message: 'No image uploaded',
        };
      }

      const imageUrl = `${req.protocol}://${req.get('host')}/uploads/chat/images/${file.filename}`;

      const sendMessageDto: SendMessageDto = {
        roomId: roomId,
        senderId: userId,
        senderType: senderType,
        content: uploadFileDto.content || '📷 Shared an image',
        messageType: 'image',
        attachments: [imageUrl],
      };

      const message = await this.chatService.sendMessage(
        roomId,
        userId,
        senderType,
        sendMessageDto,
      );

      return {
        success: true,
        message: 'Image uploaded and sent successfully',
        data: {
          message,
          imageUrl,
          uploadedFile: {
            originalName: file.originalname,
            filename: file.filename,
            size: file.size,
            url: imageUrl,
          },
        },
      };
    } catch (error) {
      this.logger.error(`❌ Error uploading image: ${error.message}`);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @Post('send-to-doctor')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send message from patient to doctor' })
  async sendMessageToDoctor(
    @Request() req,
    @Body() sendMessageDto: SendMessageDto,
  ) {
    try {
      const userId = req.user.sub || req.user.id;
      const senderType = 'patient';

      // Call with 3 parameters: (userId, senderType, sendMessageDto)
      const result = await this.chatService.sendMessage(
        userId,
        senderType,
        sendMessageDto,
      );
      return successResponse(result.data, result.message, 201);
    } catch (error) {
      this.logger.error(`Error in sendMessageToDoctor: ${error.message}`);
      return errorResponse(error.message);
    }
  }

  @Post('send-to-patient')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send message from doctor to patient' })
  async sendMessageToPatient(
    @Request() req,
    @Body() sendMessageDto: SendMessageDto,
  ) {
    try {
      const userId = req.user.sub || req.user.id;
      const senderType = 'doctor';

      // Call with 3 parameters: (userId, senderType, sendMessageDto)
      const result = await this.chatService.sendMessage(
        userId,
        senderType,
        sendMessageDto,
      );
      return successResponse(result.data, result.message, 201);
    } catch (error) {
      this.logger.error(`Error in sendMessageToPatient: ${error.message}`);
      return errorResponse(error.message);
    }
  }

  @Get('debug/token/:roomId')
  @ApiOperation({ summary: 'Debug: Check JWT token extraction' })
  async debugToken(@Param('roomId') roomId: string, @Request() req) {
    try {
      const userId = req.user.sub || req.user.id;
      const senderType = req.user.role === 'doctor' ? 'doctor' : 'patient';

      return {
        success: true,
        message: 'Token debug info',
        data: {
          roomId,
          extractedUserId: userId,
          userIdType: typeof userId,
          userIdValid: userId ? 'YES' : 'NO',
          senderType,
          fullTokenPayload: req.user,
          headers: req.headers.authorization,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @Get('debug/websocket-status')
  @ApiOperation({ summary: 'Debug: Get WebSocket connection status' })
  async debugWebSocketStatus() {
    try {
      const connectedUsersCount =
        this.chatGateway?.getConnectedUsersCount() || 0;
      const connectedUsers = this.chatGateway?.getConnectedUsers() || [];

      return {
        success: true,
        message: 'WebSocket status retrieved',
        data: {
          timestamp: new Date().toISOString(),
          connectedUsersCount,
          connectedUsers,
          gatewayAvailable: !!this.chatGateway,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @Get('debug/websocket-test')
  @ApiOperation({ summary: 'Test WebSocket server status' })
  async testWebSocketStatus() {
    try {
      return {
        success: true,
        message: 'WebSocket server is running',
        data: {
          timestamp: new Date().toISOString(),
          serverStatus: 'active',
          namespace: '/chat',
          corsEnabled: true,
          gatewayAvailable: !!this.chatGateway,
          connectedUsers: this.chatGateway?.getConnectedUsersCount() || 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @Get('debug/room-status/:roomId')
  @ApiOperation({ summary: 'Debug: Get room connection status' })
  async debugRoomStatus(@Param('roomId') roomId: string) {
    try {
      const membersCount =
        (await this.chatGateway?.getRoomMembersCount(roomId)) || 0;

      return {
        success: true,
        message: 'Room status retrieved',
        data: {
          roomId,
          membersCount,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
