import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { Appointment, AppointmentSchema } from './entities/appointment.entity';
import { DoctorsModule } from '../doctors/doctors.module';
import { UsersModule } from '../users/users.module';
import { GoogleCalendarService } from './services/google-calendar.service';
import { CallModule } from '../call/call.module';
import { AgoraService } from '../call/agora.service';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Appointment.name, schema: AppointmentSchema },
    ]),
    DoctorsModule,
    ConfigModule,
    UsersModule,
    CallModule,
    ChatModule,
  ],
  controllers: [AppointmentsController],
  providers: [AppointmentsService, GoogleCalendarService, AgoraService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
