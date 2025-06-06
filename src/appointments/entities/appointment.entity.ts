import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

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

    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Payment', required: true })
    paymentId: Types.ObjectId;
}
