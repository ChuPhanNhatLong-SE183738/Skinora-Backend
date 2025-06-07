import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { Appointment, AppointmentSchema } from './entities/appointment.entity';
import { DoctorsModule } from '../doctors/doctors.module';
import { UsersModule } from '../users/users.module';
import { GoogleCalendarService } from './services/google-calendar.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Appointment.name, schema: AppointmentSchema }
    ]),
    DoctorsModule,
    ConfigModule,
    UsersModule
  ],
  controllers: [AppointmentsController],
  providers: [AppointmentsService, GoogleCalendarService],
  exports: [AppointmentsService]
})
export class AppointmentsModule {}
