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
import { Logger, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
@WebSocketGateway({
  namespace: '/call', // Đảm bảo có dấu /
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
    credentials: false,
  },
  transports: ['websocket', 'polling'],
})
export class CallGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CallGateway.name);

  private connectedUsers = new Map<string, string>(); // userId -> socketId

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.query.token ||
        client.handshake.auth.token ||
        client.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn('No token provided in Call WebSocket connection');
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

      // Store connection
      this.connectedUsers.set(userId, client.id);

      this.logger.log(
        `📞 Call client connected: ${client.id} to namespace /call (User: ${userId})`,
      );

      client.emit('connection_ready', {
        message: 'Connected to call service',
        namespace: '/call',
        socketId: client.id,
        userId,
        userType,
      });
    } catch (error) {
      this.logger.error('Call connection authentication failed:', error);
      client.emit('connection_error', {
        error: 'Authentication failed',
        message: 'Invalid or expired token',
      });
      client.disconnect();
    }
  }
  handleDisconnect(client: Socket) {
    const userId = client.data.userId || this.getUserIdBySocket(client.id);
    if (userId) {
      this.connectedUsers.delete(userId);
      this.logger.log(`📞 User ${userId} disconnected from call service`);
    }
  }

  @SubscribeMessage('user_online')
  handleUserOnline(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    this.connectedUsers.set(data.userId, client.id);
    console.log(`User ${data.userId} is online`);
  }

  @SubscribeMessage('incoming_call')
  handleIncomingCall(
    @MessageBody()
    data: {
      callId: string;
      doctorId: string;
      patientInfo: any;
      roomId: string;
      callType: string;
      appointmentId?: string;
    },
  ) {
    const doctorSocketId = this.connectedUsers.get(data.doctorId);
    if (doctorSocketId) {
      this.server.to(doctorSocketId).emit('incoming_call', {
        ...data,
        notificationType: 'appointment_call', // Distinguish from instant calls
        message: data.appointmentId
          ? 'Scheduled appointment call'
          : 'Instant consultation',
      });
      console.log(`Incoming call sent to doctor ${data.doctorId}`);
    }
  }

  @SubscribeMessage('call_response')
  handleCallResponse(
    @MessageBody()
    data: {
      callId: string;
      patientId: string;
      accepted: boolean;
      roomId?: string;
    },
  ) {
    const patientSocketId = this.connectedUsers.get(data.patientId);
    if (patientSocketId) {
      this.server.to(patientSocketId).emit('call_response', data);
      console.log(
        `Call response sent to patient ${data.patientId}: ${data.accepted ? 'accepted' : 'declined'}`,
      );
    }
  }

  @SubscribeMessage('call_ended')
  handleCallEnded(@MessageBody() data: { callId: string; userId: string }) {
    const userSocketId = this.connectedUsers.get(data.userId);
    if (userSocketId) {
      this.server.to(userSocketId).emit('call_ended', data);
      console.log(`Call ended notification sent to user ${data.userId}`);
    }
  }

  @SubscribeMessage('call_started')
  handleCallStarted(
    @MessageBody()
    data: {
      appointmentId: string;
      callId: string;
      channelName: string;
      patientId: string;
      doctorId: string;
      initiatedBy: string;
    },
  ) {
    // Notify the other participant that call was started
    const otherUserId =
      data.initiatedBy === data.patientId ? data.doctorId : data.patientId;
    const otherUserSocketId = this.connectedUsers.get(otherUserId);

    if (otherUserSocketId) {
      this.server.to(otherUserSocketId).emit('call_started_by_other', {
        appointmentId: data.appointmentId,
        callId: data.callId,
        channelName: data.channelName,
        initiatedBy: data.initiatedBy,
        message: 'Other participant started the video call',
      });
    }
  }

  // Notify specific user
  notifyUser(userId: string, event: string, data: any) {
    const userSocketId = this.connectedUsers.get(userId);
    if (userSocketId) {
      this.server.to(userSocketId).emit(event, data);
    }
  }

  // Send incoming call notification
  async sendIncomingCallNotification(targetUserId: string, callData: any) {
    const userSocketId = this.connectedUsers.get(targetUserId);
    if (userSocketId) {
      this.server.to(userSocketId).emit('incoming_call', {
        type: 'incoming_call',
        ...callData,
        timestamp: new Date(),
      });
      this.logger.log(
        `Incoming call notification sent to user ${targetUserId}`,
      );
    } else {
      this.logger.warn(`User ${targetUserId} not connected to call service`);
    }
  }

  // Notify call accepted
  async notifyCallAccepted(
    callId: string,
    acceptedBy: string,
    targetUserId: string,
  ) {
    const userSocketId = this.connectedUsers.get(targetUserId);
    if (userSocketId) {
      this.server.to(userSocketId).emit('call_accepted', {
        callId,
        acceptedBy,
        timestamp: new Date(),
      });
      this.logger.log(
        `Call accepted notification sent to user ${targetUserId}`,
      );
    }
  }

  // Notify call declined
  async notifyCallDeclined(
    callId: string,
    declinedBy: string,
    targetUserId: string,
  ) {
    const userSocketId = this.connectedUsers.get(targetUserId);
    if (userSocketId) {
      this.server.to(userSocketId).emit('call_declined', {
        callId,
        declinedBy,
        reason: 'user_declined',
        timestamp: new Date(),
      });
      this.logger.log(
        `Call declined notification sent to user ${targetUserId}`,
      );
    }
  }

  // Notify participant joined
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
      // Notify all connected users in the call
      for (const [userId, socketId] of this.connectedUsers.entries()) {
        if (userId !== participantInfo.userId) {
          this.server.to(socketId).emit('participant_joined', {
            callId,
            newParticipant: participantInfo,
            timestamp: new Date(),
          });
        }
      }

      this.logger.log(
        `📢 Notified participants about ${participantInfo.device} device joining call ${callId}`,
      );
    } catch (error) {
      this.logger.error('Error notifying participant joined:', error);
    }
  }

  private getUserIdBySocket(socketId: string): string | undefined {
    for (const [userId, id] of this.connectedUsers.entries()) {
      if (id === socketId) {
        return userId;
      }
    }
    return undefined;
  }
}
