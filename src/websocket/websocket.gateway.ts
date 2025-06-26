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
import { RedisService } from './redis.service';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: false,
  },
  namespace: '/',
})
export class CallWebSocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CallWebSocketGateway.name);
  private connectedSockets = new Map<string, any[]>(); // userId -> [sockets]

  constructor(
    private jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}

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

  async notifyParticipantJoined(
    callId: string,
    participantInfo: {
      userId: string;
      userRole: string;
      device: string;
      joinedAt: Date;
    },
  ): Promise<void> {
    try {
      // Get all participants to notify
      const participants = await this.redisService.getCallParticipants(callId);

      // Notify all other participants
      for (const participant of participants) {
        if (
          participant.userId !== participantInfo.userId ||
          participant.device !== participantInfo.device
        ) {
          // Send notification to other participants
          const sockets = await this.getSocketsByUserId(participant.userId);
          sockets.forEach((socket) => {
            socket.emit('participant_joined', {
              callId,
              newParticipant: participantInfo,
              totalParticipants: participants.length + 1,
              timestamp: new Date(),
            });
          });
        }
      }

      console.log(
        `📢 Notified participants about ${participantInfo.device} device joining call ${callId}`,
      );
    } catch (error) {
      console.error('Error notifying participant joined:', error);
    }
  }

  // Mock method to get sockets by user ID
  private async getSocketsByUserId(userId: string): Promise<any[]> {
    // Mock implementation - return empty array for now
    return this.connectedSockets.get(userId) || [];
  }
}
