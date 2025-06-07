import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import {
  Subscription,
  SubscriptionDocument,
} from './entities/subscription.entity';
import {
  SubscriptionPlan,
  SubscriptionPlanDocument,
} from './entities/subscription-plan.entity';
import { User, UserDocument } from '../users/entities/user.entity';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(SubscriptionPlan.name)
    private subscriptionPlanModel: Model<SubscriptionPlanDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
  ) {}

  // Subscription Plans
  async createPlan(
    createPlanDto: CreateSubscriptionPlanDto,
  ): Promise<SubscriptionPlan> {
    const plan = new this.subscriptionPlanModel(createPlanDto);
    return plan.save();
  }

  async getAvailablePlans(): Promise<SubscriptionPlan[]> {
    return this.subscriptionPlanModel
      .find({ isActive: true })
      .sort({ sortOrder: 1 })
      .exec();
  }

  async getPlan(id: string): Promise<SubscriptionPlan> {
    const plan = await this.subscriptionPlanModel.findById(id).exec();
    if (!plan) {
      throw new NotFoundException(`Subscription plan with ID ${id} not found`);
    }
    return plan;
  }

  // User Subscriptions
  async purchaseSubscription(
    userId: string,
    createSubscriptionDto: CreateSubscriptionDto,
  ): Promise<Subscription> {
    // Check if user already has an active subscription
    const existingSubscription = await this.getCurrentSubscription(userId);
    if (existingSubscription) {
      throw new BadRequestException('User already has an active subscription');
    }

    // Get the plan details
    const plan = await this.getPlan(createSubscriptionDto.planId);

    const startDate = createSubscriptionDto.startDate
      ? new Date(createSubscriptionDto.startDate)
      : new Date();

    const endDate = new Date(
      new Date(startDate).setMonth(
        new Date(startDate).getMonth() + plan.duration,
      ),
    );

    const subscription = new this.subscriptionModel({
      planId: (plan as any)._id,
      userId: new Types.ObjectId(userId), // Convert string to ObjectId
      startDate,
      endDate,
      totalAmount: plan.price,
      status: 'pending', // Will change to 'active' after payment
      planName: plan.name,
      aiUsageAmount: plan.aiUsageAmount,
      meetingAmount: plan.meetingAmount,
    });

    const savedSubscription = await subscription.save();

    // Note: Don't update user's currentSubscription until payment is completed
    // This will be done in payment service

    return savedSubscription;
  }

  async activateSubscription(
    subscriptionId: string,
    paymentId: string,
  ): Promise<Subscription> {
    const subscription = await this.subscriptionModel
      .findById(subscriptionId)
      .exec();

    if (!subscription) {
      throw new NotFoundException(
        `Subscription with ID ${subscriptionId} not found`,
      );
    }

    subscription.status = 'active';
    subscription.paymentId = paymentId as any;
    await subscription.save();

    // Update user's currentSubscription
    await this.userModel.findByIdAndUpdate(subscription.userId, {
      currentSubscription: subscription._id,
    });

    return subscription;
  }

  async findAll(): Promise<Subscription[]> {
    return this.subscriptionModel
      .find()
      .populate('userId', 'fullName email')
      .exec();
  }

  async findOne(id: string): Promise<Subscription> {
    const subscription = await this.subscriptionModel
      .findById(id)
      .populate('userId', 'fullName email')
      .exec();

    if (!subscription) {
      throw new NotFoundException(`Subscription with ID ${id} not found`);
    }

    return subscription;
  }

  async getCurrentSubscription(userId: string): Promise<Subscription | null> {
    return this.subscriptionModel
      .findOne({
        userId: new Types.ObjectId(userId), // Convert string to ObjectId
        status: 'active',
        startDate: { $lte: new Date() },
        endDate: { $gte: new Date() },
      })
      .populate('planId')
      .exec();
  }

  async update(
    id: string,
    updateSubscriptionDto: UpdateSubscriptionDto,
  ): Promise<Subscription> {
    const subscription = await this.subscriptionModel
      .findByIdAndUpdate(id, updateSubscriptionDto, { new: true })
      .exec();

    if (!subscription) {
      throw new NotFoundException(`Subscription with ID ${id} not found`);
    }

    return subscription;
  }

  async remove(id: string): Promise<void> {
    const subscription = await this.subscriptionModel.findById(id).exec();

    if (!subscription) {
      throw new NotFoundException(`Subscription with ID ${id} not found`);
    }

    // Remove reference from user
    await this.userModel.findByIdAndUpdate(subscription.userId, {
      $unset: { currentSubscription: 1 },
    });

    await this.subscriptionModel.findByIdAndDelete(id).exec();
  }

  async useAiToken(
    subscriptionId: string,
    tokensUsed: number = 1,
  ): Promise<Subscription> {
    const subscription = await this.subscriptionModel
      .findById(subscriptionId)
      .exec();

    if (!subscription) {
      throw new NotFoundException(
        `Subscription with ID ${subscriptionId} not found`,
      );
    }

    if (subscription.status !== 'active') {
      throw new BadRequestException('Subscription is not active');
    }

    if (subscription.aiUsageUsed + tokensUsed > subscription.aiUsageAmount) {
      throw new BadRequestException('AI usage limit exceeded');
    }

    subscription.aiUsageUsed += tokensUsed;
    return subscription.save();
  }

  async useMeeting(subscriptionId: string): Promise<Subscription> {
    const subscription = await this.subscriptionModel
      .findById(subscriptionId)
      .exec();

    if (!subscription) {
      throw new NotFoundException(
        `Subscription with ID ${subscriptionId} not found`,
      );
    }

    if (subscription.status !== 'active') {
      throw new BadRequestException('Subscription is not active');
    }

    if (subscription.meetingsUsed >= subscription.meetingAmount) {
      throw new BadRequestException('Meeting limit exceeded');
    }

    subscription.meetingsUsed += 1;
    return subscription.save();
  }
}
