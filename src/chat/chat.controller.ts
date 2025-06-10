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
        bodyReceived: sendMessageDto,
      });

      // Validate required parameters
      if (!roomId || roomId === 'undefined') {
        throw new BadRequestException('Invalid roomId from URL parameter');
      }
      if (!userId || userId === 'undefined') {
        this.logger.error(`❌ Invalid userId from JWT token:`, req.user);
        throw new BadRequestException('Invalid userId from JWT token');
      }

      // Ensure required fields are set for validation
      if (!sendMessageDto.content) {
        throw new BadRequestException('Message content is required');
      }

      // Set the IDs from URL parameter and JWT token - but don't overwrite if already set
      sendMessageDto.chatRoomId = sendMessageDto.chatRoomId || roomId;
      sendMessageDto.roomId = sendMessageDto.roomId || roomId;
      sendMessageDto.senderId = sendMessageDto.senderId || userId;
      sendMessageDto.senderType = sendMessageDto.senderType || senderType;

      // Call with simplified signature: (roomId, userId, sendMessageDto)
      const result = await this.chatService.sendMessage(
        roomId,
        userId,
        sendMessageDto,
      );

      return {
        success: true,
        message: 'Message sent successfully',
        data: result.data || result,
      };
    } catch (error) {
      this.logger.error(`❌ Error in sendMessage controller:`, {
        error: error.message,
        stack: error.stack,
        roomId,
        userId: req.user?.sub || req.user?.id,
        reqUser: req.user,
        body: sendMessageDto,
      });
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @Post('rooms/:roomId/send-with-data')
  @ApiOperation({
    summary: 'Send message with file data (handles blob URLs)',
    description:
      'Enhanced endpoint that can process file data for blob URL conversion while maintaining frontend compatibility',
  })
  @ApiParam({ name: 'roomId', description: 'Chat room ID' })
  @ApiResponse({
    status: 200,
    description: 'Message with file data sent successfully',
    schema: {
      example: {
        success: true,
        message: 'Message sent successfully',
        data: {
          _id: '676789xyz...',
          messageText: 'Here is the document',
          messageType: 'file',
          fileUrl: '/uploads/chat/uuid-filename.pdf',
          fileName: 'document.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          attachments: ['/uploads/chat/uuid-filename.pdf'],
          timestamp: '2025-01-06T12:00:00.000Z',
        },
      },
    },
  })
  async sendMessageWithData(
    @Param('roomId') roomId: string,
    @Request() req,
    @Body() sendMessageDto: SendMessageDto,
  ) {
    try {
      const userId = req.user.sub || req.user.id;
      const senderType = req.user.role === 'doctor' ? 'doctor' : 'patient';

      this.logger.log(`🔍 [DEBUG] Controller sendMessageWithData:`, {
        roomId,
        userId,
        senderType,
        messageContent: sendMessageDto.content,
        messageType: sendMessageDto.messageType,
        hasAttachments: !!sendMessageDto.attachments?.length,
        hasFileData:
          !!sendMessageDto.fileUrl || !!sendMessageDto.attachments?.length,
        attachments: sendMessageDto.attachments,
        fileDataCount:
          sendMessageDto.attachments?.length ||
          (sendMessageDto.fileUrl ? 1 : 0),
      });

      // Validate required parameters
      if (!roomId || roomId === 'undefined') {
        throw new BadRequestException('Invalid roomId from URL parameter');
      }
      if (!userId || userId === 'undefined') {
        throw new BadRequestException('Invalid userId from JWT token');
      }
      if (!sendMessageDto.content) {
        throw new BadRequestException('Message content is required');
      }

      // Set the IDs from URL parameter and JWT token
      sendMessageDto.chatRoomId = sendMessageDto.chatRoomId || roomId;
      sendMessageDto.roomId = sendMessageDto.roomId || roomId;
      sendMessageDto.senderId = sendMessageDto.senderId || userId;
      sendMessageDto.senderType = sendMessageDto.senderType || senderType;

      // Call the service method (which will internally process attachments and file data)
      const result = await this.chatService.sendMessage(
        roomId,
        userId,
        sendMessageDto,
      );

      return {
        success: true,
        message: 'Message with file data sent successfully',
        data: result.data || result,
      };
    } catch (error) {
      this.logger.error(`❌ Error in sendMessageWithData controller:`, {
        error: error.message,
        stack: error.stack,
        roomId,
        userId: req.user?.sub || req.user?.id,
        body: sendMessageDto,
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
        `🔍 [DEBUG] Getting messages for room: ${roomId}, user: ${userId}, type: ${userType}, page: ${page}, limit: ${limit}`,
      );

      // Convert page to number and ensure it's at least 1
      const pageNum = Math.max(1, Number(page) || 1);
      const limitNum = Math.max(1, Math.min(100, Number(limit) || 50)); // Max 100 messages per request

      this.logger.log(
        `🔍 [DEBUG] Sanitized params - page: ${pageNum}, limit: ${limitNum}`,
      );

      // Call service method that queries the "message" collection directly
      const messages = await this.chatService.getMessages(
        roomId,
        pageNum,
        limitNum,
      );

      this.logger.log(`📊 [DEBUG] Found ${messages.length} messages`);

      return {
        success: true,
        message: 'Messages retrieved successfully',
        data: messages,
        pagination: {
          page: pageNum,
          limit: limitNum,
          hasMore: messages.length === limitNum, // Simple check
        },
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
  async markMessagesAsRead(@Param('roomId') roomId: string, @Request() req) {
    const userId = req.user.sub || req.user.id;

    // Remove the third parameter as service only expects 2
    await this.chatService.markMessagesAsRead(roomId, userId);

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

      // Create descriptive content with file names
      const fileNames = files.map((f) => f.originalname).join(', ');
      const content =
        uploadFileDto.content ||
        (messageType === 'image' ? `📷 ${fileNames}` : `📎 ${fileNames}`);

      this.logger.log(
        `📤 Uploading ${files.length} files for user ${userId} to room ${roomId}`,
      );

      // Use the first file for main file info
      const mainFile = files[0];
      const totalFileSize = files.reduce((total, file) => total + file.size, 0);

      this.logger.log(`🔍 Calling sendMessageInternal with:`, {
        roomId,
        userId,
        content,
        messageType,
        fileUrl: attachments[0],
        fileName: fileNames,
        fileSize: totalFileSize,
        mimeType: mainFile.mimetype,
        attachments,
      });

      // Call sendMessageInternal directly with all parameters properly passed
      const message = await this.chatService.sendMessageInternal(
        roomId, // chatRoomId
        userId, // senderId
        content, // messageText
        messageType as 'text' | 'image' | 'file', // messageType
        attachments[0], // fileUrl (primary file URL)
        fileNames, // fileName (combined file names)
        totalFileSize, // fileSize (total file size)
        mainFile.mimetype, // mimeType (primary file MIME type)
        attachments, // attachments (all file URLs)
      );

      return {
        success: true,
        message: 'Files uploaded and message sent successfully',
        data: {
          message: message,
          uploadedFiles: files.map((file, index) => ({
            originalName: file.originalname,
            filename: file.filename,
            size: file.size,
            mimeType: file.mimetype,
            url: attachments[index],
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

      this.logger.log(
        `📤 Uploading image for user ${userId} to room ${roomId}: ${imageUrl}`,
      );

      // Create descriptive message content with file info
      const messageContent = uploadFileDto.content || `📷 ${file.originalname}`;

      this.logger.log(`🔍 Calling sendMessageInternal with:`, {
        roomId,
        userId,
        messageContent,
        messageType: 'image',
        fileUrl: imageUrl,
        originalName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        attachments: [imageUrl],
      });

      // Call sendMessageInternal directly with all parameters properly passed
      const message = await this.chatService.sendMessageInternal(
        roomId, // chatRoomId
        userId, // senderId
        messageContent, // messageText
        'image', // messageType
        imageUrl, // fileUrl
        file.originalname, // fileName
        file.size, // fileSize
        file.mimetype, // mimeType
        [imageUrl], // attachments array
      );

      this.logger.log(`📨 Image message sent successfully:`, message);

      return {
        success: true,
        message: 'Image uploaded and sent successfully',
        data: {
          message: message,
          imageUrl,
          uploadedFile: {
            originalName: file.originalname,
            filename: file.filename,
            size: file.size,
            mimeType: file.mimetype,
            url: imageUrl,
          },
        },
      };
    } catch (error) {
      this.logger.error(`❌ Error uploading image: ${error.message}`);
      this.logger.error(`❌ Error stack:`, error.stack);
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
      // Extract doctorId from JWT payload
      const senderId = req.user.doctorId || req.user.sub || req.user.id;
      const senderType = 'doctor';

      this.logger.log(`🔍 [DEBUG] sendMessageToPatient:`, {
        jwtPayload: req.user,
        extractedUserId: senderId,
        senderType,
        sendMessageDto,
      });

      // Validate userId
      if (!senderId) {
        this.logger.error(`❌ Could not extract doctorId from JWT:`, req.user);
        throw new BadRequestException('Doctor ID not found in token');
      }

      // Validate required fields
      if (!sendMessageDto.content) {
        throw new BadRequestException('Message content is required');
      }

      if (!sendMessageDto.chatRoomId && !sendMessageDto.roomId) {
        throw new BadRequestException('Chat room ID is required');
      }

      // Set up the DTO with extracted values
      sendMessageDto.senderId = sendMessageDto.senderId || senderId;
      sendMessageDto.senderType = sendMessageDto.senderType || senderType;

      // Ensure chatRoomId is set
      if (!sendMessageDto.chatRoomId && sendMessageDto.roomId) {
        sendMessageDto.chatRoomId = sendMessageDto.roomId;
      }

      this.logger.log(`🔍 [DEBUG] Final DTO:`, {
        chatRoomId: sendMessageDto.chatRoomId,
        senderId: sendMessageDto.senderId,
        senderType: sendMessageDto.senderType,
        content: sendMessageDto.content,
      });

      // Call with 3 parameters: (userId, senderType, sendMessageDto)
      const result = await this.chatService.sendMessage(
        senderId,
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
      const uniqueUsersCount = this.chatGateway?.getConnectedUsersCount() || 0;
      const totalConnectionsCount =
        this.chatGateway?.getTotalConnectionsCount() || 0;
      const connectedUsers = this.chatGateway?.getConnectedUsers() || [];
      const connectionDetails = this.chatGateway?.getConnectionDetails() || {};

      return {
        success: true,
        message: 'WebSocket status retrieved',
        data: {
          timestamp: new Date().toISOString(),
          uniqueUsersCount,
          totalConnectionsCount,
          connectedUsers,
          connectionDetails,
          gatewayAvailable: !!this.chatGateway,
          serverStatus: {
            hasServer: !!(this.chatGateway as any)?.server,
            hasAdapter: !!(this.chatGateway as any)?.server?.sockets?.adapter,
            hasRooms: !!(this.chatGateway as any)?.server?.sockets?.adapter
              ?.rooms,
          },
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

  @Get('debug/room-members/:roomId')
  @ApiOperation({ summary: 'Debug: Get room members info' })
  async debugRoomMembers(@Param('roomId') roomId: string) {
    try {
      const totalConnections =
        (await this.chatGateway?.getRoomMembersCount(roomId)) || 0;

      // Get detailed info about connected users
      const connectedUsers = this.chatGateway?.getConnectedUsers() || [];
      const connectionDetails = this.chatGateway?.getConnectionDetails() || {};

      return {
        success: true,
        message: 'Room members info retrieved',
        data: {
          roomId,
          totalConnections,
          connectedUsersGlobally: connectedUsers.length,
          connectionDetails,
          timestamp: new Date().toISOString(),
          instructions: {
            note: 'Multiple devices per user are now supported',
            web: 'socket.emit("join_room", {roomId, userId})',
            mobile: 'socket.emit("join_room", {roomId, userId})',
            check: 'socket.emit("get_room_members", {roomId})',
            events: '"new_message", "message_received", "room_members_info"',
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @Get('debug/test-socket')
  @ApiOperation({ summary: 'Get socket test instructions' })
  async getSocketTestInstructions() {
    return {
      success: true,
      message: 'Socket test instructions',
      data: {
        step1: 'Open browser console and run this code:',
        webCode: `
// Copy and paste this in browser console:
const socket = io('http://localhost:3000/chat', {
  auth: { token: 'YOUR_JWT_TOKEN_HERE' },
  transports: ['websocket', 'polling']
});

socket.on('connected', (data) => {
  console.log('✅ Connected:', data);
  socket.emit('join_room', { 
    roomId: '68453485c28ff4899d2d5c82', 
    userId: 'YOUR_USER_ID' 
  });
});

socket.on('room_joined', (data) => {
  console.log('🏠 Joined room:', data);
  console.log('Room member count:', data.roomMemberCount);
});

socket.on('room_update', (data) => {
  console.log('📊 Room update:', data);
});

socket.on('user_joined', (data) => {
  console.log('👤 Someone joined:', data);
});

socket.on('new_message', (data) => {
  console.log('📨 New message:', data);
});

socket.on('message_received', (data) => {
  console.log('📨 Backup message:', data);
});

// Test room members
socket.emit('get_room_members', { roomId: '68453485c28ff4899d2d5c82' });

socket.on('room_members_info', (data) => {
  console.log('👥 Room members:', data);
});
        `,
        step2: 'Replace YOUR_JWT_TOKEN_HERE with your actual JWT token',
        step3: 'Replace YOUR_USER_ID with your actual user ID',
        step4: 'Run the code in console',
        step5: 'Check if you see connection and room join events',
        step6: 'Send a message from another device/browser tab',
        userIds: {
          patient: '683ec8811deabdaefb552180',
          doctor: '684460f8fe31c80c380b343f',
        },
      },
    };
  }

  @Get('debug/check-connections/:roomId')
  @ApiOperation({ summary: 'Debug: Check who should be connected to room' })
  async debugCheckConnections(@Param('roomId') roomId: string) {
    try {
      // Get room info from database
      const chatRoom = await this.chatService.getChatRoom(roomId);
      if (!chatRoom) {
        return {
          success: false,
          message: 'Chat room not found',
        };
      }

      // Get WebSocket connection status
      const wsStatus =
        (await this.chatGateway?.getRoomMembersCount(roomId)) || 0;
      const connectedUsers = this.chatGateway?.getConnectedUsers() || [];
      const connectionDetails = this.chatGateway?.getConnectionDetails() || {};

      // Extract user IDs from chat room
      const patientId = (chatRoom.patientId as any)?._id || chatRoom.patientId;
      const doctorId = (chatRoom.doctorId as any)?._id || chatRoom.doctorId;

      return {
        success: true,
        message: 'Connection status check',
        data: {
          roomId,
          chatRoom: {
            patientId: patientId.toString(),
            doctorId: doctorId.toString(),
            patientName: (chatRoom.patientId as any)?.fullName || 'Unknown',
            doctorName: (chatRoom.doctorId as any)?.fullName || 'Unknown',
          },
          websocket: {
            roomMemberCount: wsStatus,
            globalConnectedUsers: connectedUsers.length,
            connectionDetails,
          },
          shouldBeConnected: [patientId.toString(), doctorId.toString()],
          actuallyConnected: connectedUsers,
          missingConnections: [
            patientId.toString(),
            doctorId.toString(),
          ].filter((id) => !connectedUsers.includes(id)),
          instructions: {
            patientShouldJoin: `socket.emit('join_room', {roomId: '${roomId}', userId: '${patientId}'})`,
            doctorShouldJoin: `socket.emit('join_room', {roomId: '${roomId}', userId: '${doctorId}'})`,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @Get('debug/connection-integrity')
  @ApiOperation({ summary: 'Debug: Check connection integrity' })
  async debugConnectionIntegrity() {
    try {
      const connectedUsers = this.chatGateway?.getConnectedUsers() || [];
      const connectionDetails = this.chatGateway?.getConnectionDetails() || {};
      const totalConnections =
        this.chatGateway?.getTotalConnectionsCount() || 0;

      // Check for anomalies
      const anomalies: Array<{
        userId: string;
        deviceCount: number;
        issue: string;
      }> = [];

      for (const [userId, details] of Object.entries(connectionDetails)) {
        if ((details as any).deviceCount > 10) {
          anomalies.push({
            userId,
            deviceCount: (details as any).deviceCount,
            issue: 'Too many devices for one user',
          });
        }
      }

      return {
        success: true,
        message: 'Connection integrity check',
        data: {
          totalUsers: connectedUsers.length,
          totalConnections,
          connectionDetails,
          anomalies,
          averageDevicesPerUser:
            totalConnections / Math.max(connectedUsers.length, 1),
          timestamp: new Date().toISOString(),
          recommendations:
            anomalies.length > 0
              ? [
                  'Consider restarting the server to clean up connections',
                  'Check for connection leaks in client code',
                  'Implement connection limits per user',
                ]
              : ['Connection state looks healthy'],
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @Get('debug/messages/:roomId')
  @ApiOperation({ summary: 'Debug: Get raw messages from database' })
  async debugMessages(@Param('roomId') roomId: string) {
    try {
      // Direct database query without pagination
      const messages = await this.chatService['messageModel']
        .find({ chatRoomId: roomId })
        .select('messageText timestamp senderId isRead')
        .sort({ timestamp: 1 })
        .exec();

      const totalCount = await this.chatService['messageModel'].countDocuments({
        chatRoomId: roomId,
      });

      return {
        success: true,
        message: 'Debug messages retrieved',
        data: {
          roomId,
          totalCount,
          messages: messages.map((m) => ({
            id: m._id,
            text: m.messageText,
            senderId: m.senderId,
            timestamp: m.timestamp,
            isRead: m.isRead,
          })),
          roomIdType: typeof roomId,
          roomIdValid: require('mongoose').Types.ObjectId.isValid(roomId),
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
