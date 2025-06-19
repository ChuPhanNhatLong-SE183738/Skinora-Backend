import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
    WebSocketModule,
    UsersModule, // Add UsersModule
    DoctorsModule, // Add DoctorsModule
    SubscriptionModule, // Add SubscriptionModule
  ],
  controllers: [CallController],
  providers: [CallService, AgoraService, CallGateway],
  exports: [CallService, AgoraService, CallGateway],
})
export class CallModule {}
