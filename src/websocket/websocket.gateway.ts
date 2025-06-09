import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/',
})
export class CallWebSocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CallWebSocketGateway.name);

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.query.token ||
        client.handshake.auth.token ||
        client.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn('No token provided in WebSocket connection');
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token as string);
      const userId = payload.sub || payload.id;
      const userType =
        client.handshake.query.userType || payload.role || 'user';

      client.data.userId = userId;
      client.data.userRole = payload.role;
      client.data.userType = userType;

      await client.join(`user_${userId}`);

      this.logger.log(
        `User ${userId} (${userType}) connected with socket ${client.id}`,
      );

      client.emit('connection_status', {
        status: 'connected',
        userId,
        userType,
        timestamp: new Date(),
        message: 'WebSocket connected successfully',
      });
    } catch (error) {
      this.logger.error('Connection authentication failed:', error);
      client.emit('connection_error', {
        error: 'Authentication failed',
        message: 'Invalid or expired token',
      });
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId;

    if (userId) {
      this.logger.log(`User ${userId} disconnected`);
    }
  }

  @SubscribeMessage('ping')
  async handlePing(@ConnectedSocket() client: Socket) {
    client.emit('pong', {
      timestamp: new Date(),
      message: 'WebSocket is alive',
    });
  }

  async sendIncomingCallNotification(targetUserId: string, callData: any) {
    this.server.to(`user_${targetUserId}`).emit('incoming_call', {
      type: 'incoming_call',
      ...callData,
      timestamp: new Date(),
    });

    this.logger.log(`Incoming call notification sent to user ${targetUserId}`);
  }

  async notifyCallAccepted(
    callId: string,
    acceptedBy: string,
    targetUserId: string,
  ) {
    this.server.to(`user_${targetUserId}`).emit('call_accepted', {
      callId,
      acceptedBy,
      timestamp: new Date(),
    });
  }

  async notifyCallDeclined(
    callId: string,
    declinedBy: string,
    targetUserId: string,
  ) {
    this.server.to(`user_${targetUserId}`).emit('call_declined', {
      callId,
      declinedBy,
      reason: 'user_declined',
      timestamp: new Date(),
    });
  }
}
