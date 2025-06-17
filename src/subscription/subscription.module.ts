import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import {
  Subscription,
  SubscriptionSchema,
} from './entities/subscription.entity';
import { User, UserSchema } from '../users/entities/user.entity';
import {
  SubscriptionPlan,
  SubscriptionPlanSchema,
} from './entities/subscription-plan.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: SubscriptionPlan.name, schema: SubscriptionPlanSchema },
    ]),
    UsersModule,
  ],
  controllers: [SubscriptionController],
  providers: [SubscriptionService],
  exports: [
    SubscriptionService,
    MongooseModule.forFeature([
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: SubscriptionPlan.name, schema: SubscriptionPlanSchema },
    ]),
  ],
})
export class SubscriptionModule {}
