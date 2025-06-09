import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: false, // Change to false for mobile
    allowedHeaders: ['*'],
  },
  namespace: '/chat',
  transports: ['websocket', 'polling'], // Add both transports
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private connectedUsers = new Map<string, string>(); // userId -> socketId
  private userSockets = new Map<string, Socket>(); // socketId -> socket

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    this.logger.log(`🔌 New connection attempt: ${client.id}`);
    this.logger.log(`🔍 Handshake data:`, {
      query: client.handshake.query,
      auth: client.handshake.auth,
      headers: Object.keys(client.handshake.headers),
    });

    try {
      // Extract token from multiple sources
      const token =
        client.handshake.auth?.token ||
        client.handshake.query?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`❌ Client ${client.id} connected without token`);
        client.emit('connection_error', {
          message: 'Authentication token required',
          code: 'NO_TOKEN',
        });
        return;
      }

      this.logger.log(
        `🔑 Token found for client ${client.id}: ${token.substring(0, 50)}...`,
      );
      this.logger.log(
        `🔧 JWT Secret from config: ${this.configService
          .get('JWT_SECRET')
          ?.substring(0, 20)}...`,
      );

      // Verify JWT token with explicit secret
      const jwtSecret = this.configService.get<string>('JWT_SECRET');
      if (!jwtSecret) {
        this.logger.error(`❌ JWT_SECRET not found in config`);
        client.emit('connection_error', {
          message: 'Server configuration error',
          code: 'CONFIG_ERROR',
        });
        return;
      }

      const payload = this.jwtService.verify(token, { secret: jwtSecret });
      const userId = payload.sub || payload.id;

      this.logger.log(`✅ Token verified successfully for user: ${userId}`);

      if (!userId) {
        this.logger.warn(`❌ Invalid token payload for client ${client.id}`);
        client.emit('connection_error', {
          message: 'Invalid token payload',
          code: 'INVALID_TOKEN',
        });
        return;
      }

      // Store user connection
      this.connectedUsers.set(userId, client.id);
      this.userSockets.set(client.id, client);

      // Join user to their personal room
      client.join(`user_${userId}`);

      this.logger.log(`✅ User ${userId} connected with socket ${client.id}`);

      // Notify user is online
      client.emit('connected', {
        message: 'Connected to chat successfully',
        userId,
        socketId: client.id,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(`❌ Connection error for ${client.id}:`, {
        message: error.message,
        name: error.name,
        stack: error.stack?.substring(0, 200),
      });

      client.emit('connection_error', {
        message: 'Token verification failed',
        code: 'TOKEN_ERROR',
        details: error.message,
      });
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`🔌 Client disconnecting: ${client.id}`);

    // Find and remove user from connected users
    for (const [userId, socketId] of this.connectedUsers.entries()) {
      if (socketId === client.id) {
        this.connectedUsers.delete(userId);
        this.logger.log(`❌ User ${userId} disconnected (${client.id})`);
        break;
      }
    }

    this.userSockets.delete(client.id);
  }

  @SubscribeMessage('test_connection')
  async handleTestConnection(@ConnectedSocket() client: Socket) {
    this.logger.log(`🧪 Test connection from ${client.id}`);
    client.emit('test_response', {
      message: 'WebSocket connection is working',
      timestamp: new Date(),
      socketId: client.id,
    });
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string },
  ) {
    try {
      const { roomId, userId } = data;

      // Validate data
      if (!roomId || !userId) {
        client.emit('error', { message: 'roomId and userId are required' });
        return;
      }

      // Join room
      client.join(`room_${roomId}`);

      this.logger.log(`👥 User ${userId} joined room ${roomId}`);

      // Notify user joined room
      client.emit('room_joined', {
        roomId,
        message: 'Successfully joined chat room',
        timestamp: new Date(),
      });

      // Notify others in room
      client.to(`room_${roomId}`).emit('user_joined', {
        userId,
        roomId,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(`❌ Error joining room:`, error);
      client.emit('error', { message: 'Failed to join room' });
    }
  }

  @SubscribeMessage('leave_room')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string },
  ) {
    try {
      const { roomId, userId } = data;

      // Leave room
      client.leave(`room_${roomId}`);

      this.logger.log(`👋 User ${userId} left room ${roomId}`);

      // Notify others in room
      client.to(`room_${roomId}`).emit('user_left', {
        userId,
        roomId,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(`❌ Error leaving room:`, error);
    }
  }

  @SubscribeMessage('typing_start')
  async handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string; userName: string },
  ) {
    const { roomId, userId, userName } = data;

    // Notify others in room that user is typing
    client.to(`room_${roomId}`).emit('user_typing', {
      userId,
      userName,
      roomId,
      isTyping: true,
      timestamp: new Date(),
    });
  }

  @SubscribeMessage('typing_stop')
  async handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string },
  ) {
    const { roomId, userId } = data;

    // Notify others in room that user stopped typing
    client.to(`room_${roomId}`).emit('user_typing', {
      userId,
      roomId,
      isTyping: false,
      timestamp: new Date(),
    });
  }

  @SubscribeMessage('ping')
  async handlePing(@ConnectedSocket() client: Socket) {
    client.emit('pong', { timestamp: new Date() });
  }

  // Method to broadcast new message to room
  async broadcastMessage(roomId: string, message: any) {
    try {
      this.logger.log(`📡 Broadcasting message to room ${roomId}`);

      this.server.to(`room_${roomId}`).emit('new_message', {
        message,
        roomId,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(`❌ Error broadcasting message:`, error);
    }
  }

  // Method to send message to specific user
  async sendToUser(userId: string, event: string, data: any) {
    try {
      const socketId = this.connectedUsers.get(userId);

      if (socketId) {
        const socket = this.userSockets.get(socketId);
        if (socket) {
          socket.emit(event, data);
          this.logger.log(`📤 Sent ${event} to user ${userId}`);
        }
      } else {
        this.logger.warn(`⚠️ User ${userId} not connected for event ${event}`);
      }
    } catch (error) {
      this.logger.error(`❌ Error sending to user ${userId}:`, error);
    }
  }

  // Get connected users count
  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  // Get connected users list
  getConnectedUsers(): string[] {
    return Array.from(this.connectedUsers.keys());
  }

  // Check if user is online
  isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  // Get room members count
  async getRoomMembersCount(roomId: string): Promise<number> {
    const room = this.server.sockets.adapter.rooms.get(`room_${roomId}`);
    return room ? room.size : 0;
  }
}
