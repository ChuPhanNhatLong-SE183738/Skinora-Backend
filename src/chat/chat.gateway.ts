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
  private connectedUsers = new Map<string, Set<string>>(); // userId -> Set of socketIds
  private userSockets = new Map<string, Socket>(); // socketId -> socket
  private socketUsers = new Map<string, string>(); // socketId -> userId

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    // Start periodic cleanup when gateway initializes
    this.startPeriodicCleanup();
  }

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

      // Store user connection with multiple device support
      if (!this.connectedUsers.has(userId)) {
        this.connectedUsers.set(userId, new Set());
      }
      this.connectedUsers.get(userId)!.add(client.id);
      this.userSockets.set(client.id, client);
      this.socketUsers.set(client.id, userId);

      // Join user to their personal room
      client.join(`user_${userId}`);

      const deviceCount = this.connectedUsers.get(userId)!.size;
      this.logger.log(
        `✅ User ${userId} connected with socket ${client.id} (device ${deviceCount})`,
      );

      // Notify user is online with device info
      client.emit('connected', {
        message: 'Connected to chat successfully',
        userId,
        socketId: client.id,
        deviceCount,
        totalConnectedUsers: this.connectedUsers.size,
        timestamp: new Date(),
      });

      // Broadcast to other devices of same user
      client.to(`user_${userId}`).emit('user_device_connected', {
        userId,
        newSocketId: client.id,
        totalDevices: deviceCount,
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

    const userId = this.socketUsers.get(client.id);
    if (userId) {
      const userSockets = this.connectedUsers.get(userId);
      if (userSockets) {
        userSockets.delete(client.id);

        if (userSockets.size === 0) {
          // No more devices for this user
          this.connectedUsers.delete(userId);
          this.logger.log(
            `❌ User ${userId} completely disconnected (no devices left)`,
          );
        } else {
          this.logger.log(
            `❌ User ${userId} device disconnected (${userSockets.size} devices remaining)`,
          );
          // Notify other devices of same user
          client.to(`user_${userId}`).emit('user_device_disconnected', {
            userId,
            disconnectedSocketId: client.id,
            remainingDevices: userSockets.size,
            timestamp: new Date(),
          });
        }
      }
      this.socketUsers.delete(client.id);
    }

    this.userSockets.delete(client.id);

    // Clean up any stale connections
    this.cleanupStaleConnections();
  }

  // Add periodic cleanup
  private startPeriodicCleanup() {
    setInterval(() => {
      this.cleanupStaleConnections();
    }, 30000); // Clean every 30 seconds
  }

  // Add cleanup method for stale connections
  private cleanupStaleConnections() {
    let cleanedCount = 0;

    // Check if sockets in userSockets are still connected
    for (const [socketId, socket] of this.userSockets.entries()) {
      if (!socket.connected) {
        this.userSockets.delete(socketId);

        // Remove from user tracking
        const userId = this.socketUsers.get(socketId);
        if (userId) {
          const userSockets = this.connectedUsers.get(userId);
          if (userSockets) {
            userSockets.delete(socketId);
            if (userSockets.size === 0) {
              this.connectedUsers.delete(userId);
            }
          }
          this.socketUsers.delete(socketId);
        }
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.log(`🧹 Cleaned up ${cleanedCount} stale connections`);
    }
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

      // Join room FIRST
      client.join(`room_${roomId}`);

      // THEN get room member count (after joining)
      let roomMemberCount = 0;
      try {
        const room = this.server?.sockets?.adapter?.rooms?.get(
          `room_${roomId}`,
        );
        roomMemberCount = room ? room.size : 0;
      } catch (error) {
        this.logger.warn(
          `⚠️ Could not get room member count: ${error.message}`,
        );
        roomMemberCount = 1; // Fallback value
      }

      const userDeviceCount = this.connectedUsers.get(userId)?.size || 0;

      this.logger.log(
        `👥 User ${userId} (device ${client.id}) joined room ${roomId} - Room NOW has ${roomMemberCount} total connections`,
      );

      // Notify user joined room
      client.emit('room_joined', {
        roomId,
        message: 'Successfully joined chat room',
        roomMemberCount,
        userDeviceCount,
        socketId: client.id,
        timestamp: new Date(),
      });

      // Notify others in room (after join, so they get updated count too)
      client.to(`room_${roomId}`).emit('user_joined', {
        userId,
        roomId,
        socketId: client.id,
        roomMemberCount,
        newUserName: `User ${userId}`,
        timestamp: new Date(),
      });

      // Send updated room info to all members
      setTimeout(() => {
        this.broadcastRoomUpdate(roomId);
      }, 100);
    } catch (error) {
      this.logger.error(`❌ Error joining room:`, error);
      client.emit('error', {
        message: 'Failed to join room',
        details: error.message,
      });
    }
  }

  // Add method to broadcast room updates
  private async broadcastRoomUpdate(roomId: string) {
    try {
      const room = this.server?.sockets?.adapter?.rooms?.get(`room_${roomId}`);
      const memberCount = room ? room.size : 0;
      const socketIds = room ? Array.from(room) : [];

      // Get unique users in room
      const uniqueUsers = new Set<string>();
      socketIds.forEach((socketId) => {
        const userId = this.socketUsers.get(socketId);
        if (userId) uniqueUsers.add(userId);
      });

      this.logger.log(
        `📊 Broadcasting room update - Room ${roomId}: ${memberCount} connections, ${uniqueUsers.size} unique users`,
      );

      // Broadcast to all room members
      this.server.to(`room_${roomId}`).emit('room_update', {
        roomId,
        totalConnections: memberCount,
        uniqueUsers: uniqueUsers.size,
        userList: Array.from(uniqueUsers),
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(`❌ Error broadcasting room update:`, error);
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

      // Safely get room members with null checking
      let memberCount = 0;
      let room: Set<string> | undefined;

      try {
        room = this.server?.sockets?.adapter?.rooms?.get(`room_${roomId}`);
        memberCount = room ? room.size : 0;
      } catch (error) {
        this.logger.warn(`⚠️ Could not get room info: ${error.message}`);
      }

      this.logger.log(`🏠 Room room_${roomId} has ${memberCount} members`);

      if (memberCount === 0) {
        this.logger.warn(
          `⚠️ No members in room room_${roomId} to broadcast to`,
        );
      }

      // Broadcast to room
      this.server.to(`room_${roomId}`).emit('new_message', {
        message,
        roomId,
        timestamp: new Date(),
        type: 'new_message',
      });

      this.logger.log(
        `📨 Message broadcasted to ${memberCount} members in room_${roomId}`,
      );

      // Also broadcast to individual users for backup
      if (message.senderId && room) {
        const senderId =
          typeof message.senderId === 'object'
            ? message.senderId._id
            : message.senderId;

        // Find other participants in the room and send direct messages
        const socketIds = Array.from(room || []);
        socketIds.forEach((socketId) => {
          const socket = this.userSockets.get(socketId);
          if (socket) {
            this.logger.log(`📤 Sending backup message to socket ${socketId}`);
            socket.emit('message_received', {
              message,
              roomId,
              timestamp: new Date(),
              type: 'backup_delivery',
            });
          }
        });
      }
    } catch (error) {
      this.logger.error(`❌ Error broadcasting message:`, error);
    }
  }

  @SubscribeMessage('get_room_members')
  async handleGetRoomMembers(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    try {
      const { roomId } = data;

      // Safely get room info with null checking
      let memberCount = 0;
      let socketIds: string[] = [];
      let room: Set<string> | undefined;

      try {
        room = this.server?.sockets?.adapter?.rooms?.get(`room_${roomId}`);
        memberCount = room ? room.size : 0;
        socketIds = room ? Array.from(room) : [];
      } catch (error) {
        this.logger.warn(`⚠️ Could not get room members: ${error.message}`);
      }

      // Get unique users in room
      const uniqueUsers = new Set<string>();
      socketIds.forEach((socketId) => {
        const userId = this.socketUsers.get(socketId);
        if (userId) uniqueUsers.add(userId);
      });

      this.logger.log(
        `🔍 Room ${roomId} has ${memberCount} total connections from ${uniqueUsers.size} unique users`,
      );

      client.emit('room_members_info', {
        roomId,
        totalConnections: memberCount,
        uniqueUsers: uniqueUsers.size,
        socketIds,
        userList: Array.from(uniqueUsers),
        timestamp: new Date(),
        serverInfo: {
          hasAdapter: !!this.server?.sockets?.adapter,
          hasRooms: !!this.server?.sockets?.adapter?.rooms,
        },
      });
    } catch (error) {
      this.logger.error(`❌ Error getting room members:`, error);
      client.emit('error', {
        message: 'Failed to get room members',
        details: error.message,
      });
    }
  }

  // Method to send message to specific user (all devices) with better error handling
  async sendToUser(userId: string, event: string, data: any) {
    try {
      const userSockets = this.connectedUsers.get(userId);

      if (userSockets && userSockets.size > 0) {
        let sentCount = 0;
        let errorCount = 0;

        // Convert Set to Array to safely iterate
        const socketIds = Array.from(userSockets);

        for (const socketId of socketIds) {
          const socket = this.userSockets.get(socketId);
          if (socket && socket.connected) {
            try {
              socket.emit(event, data);
              sentCount++;
            } catch (error) {
              this.logger.warn(
                `⚠️ Failed to send to socket ${socketId}: ${error.message}`,
              );
              errorCount++;

              // Remove problematic socket
              this.userSockets.delete(socketId);
              userSockets.delete(socketId);
              this.socketUsers.delete(socketId);
            }
          } else {
            // Remove disconnected socket
            this.userSockets.delete(socketId);
            userSockets.delete(socketId);
            this.socketUsers.delete(socketId);
            errorCount++;
          }
        }

        // Clean up empty user entry
        if (userSockets.size === 0) {
          this.connectedUsers.delete(userId);
        }

        this.logger.log(
          `📤 Sent ${event} to user ${userId}: ${sentCount} successful, ${errorCount} failed/cleaned`,
        );
      } else {
        this.logger.warn(`⚠️ User ${userId} not connected for event ${event}`);
      }
    } catch (error) {
      this.logger.error(`❌ Error sending to user ${userId}:`, error);
    }
  }

  // Add debug method to check connection integrity
  @SubscribeMessage('debug_connections')
  async handleDebugConnections(@ConnectedSocket() client: Socket) {
    const userId = this.socketUsers.get(client.id);
    const userSocketsCount = userId
      ? this.connectedUsers.get(userId)?.size || 0
      : 0;
    const totalUsers = this.connectedUsers.size;
    const totalConnections = this.getTotalConnectionsCount();

    client.emit('debug_connections_response', {
      userId: userId || 'unknown',
      socketId: client.id,
      userSocketsCount,
      totalUsers,
      totalConnections,
      timestamp: new Date(),
    });

    this.logger.log(
      `🔍 Debug connections for user ${userId || 'unknown'}: ${userSocketsCount} sockets`,
    );
  }

  // Get connected users count (unique users)
  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  // Get total connections count
  getTotalConnectionsCount(): number {
    let total = 0;
    this.connectedUsers.forEach((sockets) => {
      total += sockets.size;
    });
    return total;
  }

  // Get connected users list
  getConnectedUsers(): string[] {
    return Array.from(this.connectedUsers.keys());
  }

  // Get detailed connection info
  getConnectionDetails() {
    const details: any = {};
    this.connectedUsers.forEach((sockets, userId) => {
      details[userId] = {
        deviceCount: sockets.size,
        socketIds: Array.from(sockets),
      };
    });
    return details;
  }

  // Check if user is online
  isUserOnline(userId: string): boolean {
    return (
      this.connectedUsers.has(userId) &&
      this.connectedUsers.get(userId)!.size > 0
    );
  }

  // Get room members count
  async getRoomMembersCount(roomId: string): Promise<number> {
    try {
      const room = this.server?.sockets?.adapter?.rooms?.get(`room_${roomId}`);
      return room ? room.size : 0;
    } catch (error) {
      this.logger.warn(`⚠️ Could not get room member count: ${error.message}`);
      return 0;
    }
  }
}
