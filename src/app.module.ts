import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { AnalysisModule } from './analysis/analysis.module';
import { PromotionsModule } from './promotions/promotions.module';
import { CategoriesModule } from './categories/categories.module';
import { ReviewsModule } from './reviews/reviews.module';
import { DoctorsModule } from './doctors/doctors.module';
import { SpecializationsModule } from './specializations/specializations.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { PaymentModule } from './payment/payment.module';
import { ChatModule } from './chat/chat.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { ChatMessagesModule } from './chat_messages/chat_messages.module';
import { ChatHistoryModule } from './chat_history/chat_history.module';
import { WebSocketModule } from './websocket/websocket.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRoot(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/skinora',
    ),
    AuthModule,
    UsersModule,
    ProductsModule,
    AnalysisModule,
    PromotionsModule,
    CategoriesModule,
    ReviewsModule,
    DoctorsModule,
    SpecializationsModule,
    AppointmentsModule,
    SubscriptionModule,
    PaymentModule,
    ChatModule,
    ChatMessagesModule,
    ChatHistoryModule,
    WebSocketModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
  ],
})
export class AppModule {}
