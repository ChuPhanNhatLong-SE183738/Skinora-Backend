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
import { ChatService } from './chat.service';
import { CreateChatRoomDto } from './dto/create-chat-room.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../users/enums/role.enum';
import { Logger } from '@nestjs/common';

@ApiTags('chat')
@ApiBearerAuth()
@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly chatService: ChatService) {}

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
  @ApiOperation({ summary: 'Send a message in chat room' })
  @ApiParam({ name: 'roomId', description: 'Chat room ID' })
  @ApiResponse({
    status: 201,
    description: 'Message sent successfully',
    schema: {
      example: {
        success: true,
        message: 'Message sent successfully',
        data: {
          _id: '676789xyz...',
          chatRoomId: '676123abc...',
          senderId: { _id: '675abc123...', fullName: 'John Doe' },
          senderType: 'patient',
          content: 'Hello doctor, I need help',
          messageType: 'text',
          isRead: false,
          createdAt: '2025-01-06T12:00:00.000Z',
        },
      },
    },
  })
  async sendMessage(
    @Param('roomId') roomId: string,
    @Body() sendMessageDto: SendMessageDto,
    @Request() req,
  ) {
    try {
      const userId = req.user.sub || req.user.id;
      const senderType = req.user.role === 'doctor' ? 'doctor' : 'patient';

      this.logger.log(`📥 POST /chat/rooms/${roomId}/messages`);
      this.logger.log(`Sender: ${userId} (${senderType})`);
      this.logger.log(`Message: ${sendMessageDto.content}`);

      const message = await this.chatService.sendMessage(
        roomId,
        userId,
        senderType,
        sendMessageDto,
      );

      this.logger.log(`✅ Message sent successfully: ${(message as any)._id}`);
      return {
        success: true,
        message: 'Message sent successfully',
        data: message,
      };
    } catch (error) {
      this.logger.error(`❌ Error sending message: ${error.message}`);
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
    const userId = req.user.sub || req.user.id;
    const userType = req.user.role === 'doctor' ? 'doctor' : 'patient';

    const messages = await this.chatService.getChatMessages(
      roomId,
      userId,
      userType,
      +page,
      +limit,
    );

    return {
      success: true,
      message: 'Messages retrieved successfully',
      data: messages,
    };
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
    @Body() body: { content?: string },
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
      const messageType = files.some((file) =>
        ['image/jpeg', 'image/png', 'image/gif'].includes(file.mimetype),
      )
        ? 'image'
        : 'file';

      const content =
        body.content ||
        (messageType === 'image' ? '📷 Shared an image' : '📎 Shared a file');

      const sendMessageDto = {
        content,
        messageType,
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
    @Body() body: { content?: string },
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

      const sendMessageDto = {
        content: body.content || '📷 Shared an image',
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
}
