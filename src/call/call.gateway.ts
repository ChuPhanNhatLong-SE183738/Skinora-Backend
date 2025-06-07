import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class CallGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<string, string>(); // userId -> socketId

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    // Remove user from connected users
    for (const [userId, socketId] of this.connectedUsers.entries()) {
      if (socketId === client.id) {
        this.connectedUsers.delete(userId);
        break;
      }
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
}
