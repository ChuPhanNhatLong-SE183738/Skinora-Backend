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

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Call.name, schema: CallSchema },
      { name: User.name, schema: UserSchema },
      { name: Doctor.name, schema: DoctorSchema },
    ]),
    SubscriptionModule, // Import SubscriptionModule for SubscriptionService
  ],
  controllers: [CallController],
  providers: [CallService, AgoraService],
  exports: [CallService, AgoraService],
})
export class CallModule {}
