import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: '/chat',
  transports: ['websocket', 'polling'],
  allowEIO3: true, // Add compatibility
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private connectedUsers = new Map<string, string>(); // userId -> socketId
  private connectionCount = 0; // Track manually

  afterInit(server: Server) {
    this.logger.log('🚀 Chat WebSocket Gateway initialized');
    this.logger.log(`Server running on namespace: /chat`);

    // Add error handling for server
    server.on('error', (error) => {
      this.logger.error(`Socket.IO server error: ${error.message}`);
    });
  }

  handleConnection(client: Socket) {
    try {
      this.connectionCount++;

      this.logger.log(`✅ Chat client connected: ${client.id}`);
      this.logger.log(
        `Client handshake query: ${JSON.stringify(client.handshake.query)}`,
      );
      this.logger.log(`Client address: ${client.handshake.address}`);
      this.logger.log(`Connected clients count: ${this.connectionCount}`);

      // Send welcome message
      client.emit('connection_status', {
        status: 'connected',
        socketId: client.id,
        timestamp: new Date().toISOString(),
        connectedCount: this.connectionCount,
      });

      // Handle client errors
      client.on('error', (error) => {
        this.logger.error(`Client ${client.id} error: ${error.message}`);
      });
    } catch (error) {
      this.logger.error(`Error in handleConnection: ${error.message}`);
    }
  }

  handleDisconnect(client: Socket) {
    try {
      this.connectionCount = Math.max(0, this.connectionCount - 1);

      this.logger.log(`❌ Chat client disconnected: ${client.id}`);

      // Remove user from connected users
      let disconnectedUserId = null;
      for (const [userId, socketId] of this.connectedUsers.entries()) {
        if (socketId === client.id) {
          this.connectedUsers.delete(userId);
          (disconnectedUserId as any) = userId;
          break;
        }
      }

      this.logger.log(`Disconnected user ID: ${disconnectedUserId}`);
      this.logger.log(`Remaining connected users: ${this.connectedUsers.size}`);
      this.logger.log(`Total connected clients: ${this.connectionCount}`);
    } catch (error) {
      this.logger.error(`Error in handleDisconnect: ${error.message}`);
    }
  }

  @SubscribeMessage('join_chat')
  handleJoinChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; chatRoomId: string },
  ) {
    try {
      this.logger.log(`🔗 User joining chat - Data: ${JSON.stringify(data)}`);

      if (!data.userId || !data.chatRoomId) {
        this.logger.error('❌ Missing userId or chatRoomId in join_chat');
        client.emit('error', {
          message: 'Missing required fields: userId, chatRoomId',
        });
        return;
      }

      this.connectedUsers.set(data.userId, client.id);
      client.join(data.chatRoomId);

      this.logger.log(
        `✅ User ${data.userId} joined chat room ${data.chatRoomId}`,
      );
      this.logger.log(
        `Current connected users: ${Array.from(this.connectedUsers.keys()).join(', ')}`,
      );

      client.emit('joined_chat', {
        success: true,
        chatRoomId: data.chatRoomId,
        userId: data.userId,
        socketId: client.id,
        timestamp: new Date().toISOString(),
      });

      // Notify room about new participant
      client.to(data.chatRoomId).emit('user_joined_room', {
        userId: data.userId,
        socketId: client.id,
      });
    } catch (error) {
      this.logger.error(`❌ Error in join_chat: ${error.message}`);
      client.emit('error', {
        message: 'Failed to join chat room',
        error: error.message,
      });
    }
  }

  @SubscribeMessage('leave_chat')
  handleLeaveChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatRoomId: string; userId?: string },
  ) {
    try {
      this.logger.log(`👋 Client leaving chat room: ${JSON.stringify(data)}`);

      client.leave(data.chatRoomId);

      // Notify room about participant leaving
      client.to(data.chatRoomId).emit('user_left_room', {
        userId: data.userId,
        socketId: client.id,
      });

      this.logger.log(
        `✅ Client ${client.id} left chat room ${data.chatRoomId}`,
      );
    } catch (error) {
      this.logger.error(`❌ Error in leave_chat: ${error.message}`);
    }
  }

  @SubscribeMessage('typing_start')
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { chatRoomId: string; userId: string; userName: string },
  ) {
    try {
      this.logger.debug(
        `⌨️ User ${data.userId} started typing in room ${data.chatRoomId}`,
      );

      client.to(data.chatRoomId).emit('user_typing', {
        userId: data.userId,
        userName: data.userName,
        isTyping: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`❌ Error in typing_start: ${error.message}`);
    }
  }

  @SubscribeMessage('typing_stop')
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatRoomId: string; userId: string },
  ) {
    try {
      this.logger.debug(
        `⌨️ User ${data.userId} stopped typing in room ${data.chatRoomId}`,
      );

      client.to(data.chatRoomId).emit('user_typing', {
        userId: data.userId,
        isTyping: false,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`❌ Error in typing_stop: ${error.message}`);
    }
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    this.logger.debug(`🏓 Ping received from ${client.id}`);
    client.emit('pong', { timestamp: new Date().toISOString() });
  }

  @SubscribeMessage('send_message')
  handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      chatRoomId: string;
      content: string;
      messageType?: string;
      userId: string;
    },
  ) {
    try {
      this.logger.log(
        `📨 Direct message via WebSocket: ${JSON.stringify(data)}`,
      );

      // Broadcast message to room immediately
      client.to(data.chatRoomId).emit('new_message_broadcast', {
        ...data,
        socketId: client.id,
        timestamp: new Date().toISOString(),
      });

      client.emit('message_acknowledged', {
        success: true,
        chatRoomId: data.chatRoomId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`❌ Error in send_message: ${error.message}`);
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('get_room_members')
  handleGetRoomMembers(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatRoomId: string },
  ) {
    try {
      const room = this.server.sockets.adapter.rooms.get(data.chatRoomId);
      const memberCount = room ? room.size : 0;

      this.logger.log(`Room ${data.chatRoomId} has ${memberCount} members`);

      client.emit('room_members', {
        chatRoomId: data.chatRoomId,
        memberCount,
        members: room ? Array.from(room) : [],
      });
    } catch (error) {
      this.logger.error(`❌ Error getting room members: ${error.message}`);
    }
  }

  // Send message to specific user with retry
  sendMessageToUser(userId: string, event: string, data: any) {
    try {
      const socketId = this.connectedUsers.get(userId);
      this.logger.log(
        `📤 Sending '${event}' to user ${userId} (socket: ${socketId})`,
      );
      this.logger.log(`📤 Data:`, data);

      if (socketId && this.server) {
        this.server.to(socketId).emit(event, {
          ...data,
          timestamp: new Date().toISOString(),
        });
        this.logger.log(`✅ Message sent successfully to user ${userId}`);
      } else {
        this.logger.warn(
          `⚠️ User ${userId} not connected or server unavailable`,
        );

        // Try to find user in any room and send there
        if (data.chatRoomId) {
          this.logger.log(`🔄 Trying to send via room ${data.chatRoomId}`);
          this.sendMessageToRoom(data.chatRoomId, event, data);
        }
      }
    } catch (error) {
      this.logger.error(
        `❌ Error sending message to user ${userId}: ${error.message}`,
      );
    }
  }

  // Send message to chat room with better logging
  sendMessageToRoom(chatRoomId: string, event: string, data: any) {
    try {
      this.logger.log(`📤 Sending '${event}' to room ${chatRoomId}`);
      this.logger.log(`📤 Room data:`, data);

      if (this.server) {
        // Check room exists and has members
        const room = this.server.sockets.adapter.rooms.get(chatRoomId);
        const memberCount = room ? room.size : 0;

        this.logger.log(`Room ${chatRoomId} has ${memberCount} members`);

        this.server.to(chatRoomId).emit(event, {
          ...data,
          timestamp: new Date().toISOString(),
          roomMemberCount: memberCount,
        });

        this.logger.log(`✅ Message sent successfully to room ${chatRoomId}`);
      } else {
        this.logger.error(
          `❌ Server unavailable - cannot send message to room`,
        );
      }
    } catch (error) {
      this.logger.error(
        `❌ Error sending message to room ${chatRoomId}: ${error.message}`,
      );
    }
  }

  // Get connected users count
  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  // Get total connections count (manual tracking)
  getTotalConnectionsCount(): number {
    return this.connectionCount;
  }

  // Get all connected users
  getConnectedUsers(): string[] {
    return Array.from(this.connectedUsers.keys());
  }

  // Health check method
  isServerReady(): boolean {
    return !!this.server;
  }
}
