import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Appointment {
    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
    userId: Types.ObjectId;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Doctor', required: true })
    doctorId: Types.ObjectId;

    @Prop({ type: Date, required: true })
    startTime: Date;

    @Prop({ type: Date, required: true })
    endTime: Date;

    @Prop({ type: String, required: true })
    meetingUrl: string;
    
    @Prop({ type: String, required: false })
    googleEventId: string;

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Payment', required: false })
    paymentId: Types.ObjectId;

    @Prop({ type: String, required: true, enum: ['scheduled', 'completed', 'cancelled'], default: 'scheduled' })
    appointmentStatus: string;
}

export type AppointmentDocument = Appointment & Document;
export const AppointmentSchema = SchemaFactory.createForClass(Appointment);