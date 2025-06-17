import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AgoraService } from './agora.service';
import { User, UserSchema } from '../users/entities/user.entity';
import { SubscriptionModule } from '../subscription/subscription.module';
import { Call, CallSchema } from './entities/call.entity';
import { CallController } from './call.controller';
import { CallService } from './call.service';
import { CallGateway } from './call.gateway';
import { Doctor, DoctorSchema } from '../doctors/entities/doctor.entity';
import { WebSocketModule } from '../websocket/websocket.module';
import { UsersModule } from '../users/users.module'; // Import UsersModule
import { DoctorsModule } from '../doctors/doctors.module'; // Import DoctorsModule

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Call.name, schema: CallSchema }]),
    WebSocketModule,
    UsersModule, // Add UsersModule
    DoctorsModule, // Add DoctorsModule
    SubscriptionModule, // Add SubscriptionModule
  ],
  controllers: [CallController],
  providers: [CallService, AgoraService],
  exports: [CallService, AgoraService],
})
export class CallModule {}
