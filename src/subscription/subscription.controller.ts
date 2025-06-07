import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SubscriptionService } from './subscription.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { successResponse, errorResponse } from '../helper/response.helper';

@ApiTags('subscriptions')
@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  // Subscription Plans Management
  @Post('plans')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new subscription plan (Admin only)' })
  async createPlan(@Body() createPlanDto: CreateSubscriptionPlanDto) {
    try {
      const plan = await this.subscriptionService.createPlan(createPlanDto);
      return successResponse(
        plan,
        'Subscription plan created successfully',
        201,
      );
    } catch (error) {
      return errorResponse(error.message);
    }
  }

  @Get('plans')
  @ApiOperation({ summary: 'Get all available subscription plans' })
  @ApiResponse({ status: 200, description: 'Return all available plans' })
  async getAvailablePlans() {
    try {
      const plans = await this.subscriptionService.getAvailablePlans();
      return successResponse(
        plans,
        'Subscription plans retrieved successfully',
      );
    } catch (error) {
      return errorResponse(error.message);
    }
  }

  @Get('plans/:id')
  @ApiOperation({ summary: 'Get subscription plan by ID' })
  async getPlan(@Param('id') id: string) {
    try {
      const plan = await this.subscriptionService.getPlan(id);
      return successResponse(plan, 'Subscription plan retrieved successfully');
    } catch (error) {
      return errorResponse(error.message);
    }
  }

  // User Subscriptions
  @Post('purchase/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Purchase a subscription plan' })
  @ApiResponse({ status: 201, description: 'Subscription purchase initiated' })
  async purchaseSubscription(
    @Param('userId') userId: string,
    @Body() createSubscriptionDto: CreateSubscriptionDto,
  ) {
    try {
      const subscription = await this.subscriptionService.purchaseSubscription(
        userId,
        createSubscriptionDto,
      );
      return successResponse(
        subscription,
        'Subscription purchase initiated successfully',
        201,
      );
    } catch (error) {
      return errorResponse(error.message);
    }
  }

  @Get('user/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current subscription for user' })
  async getCurrentSubscription(@Param('userId') userId: string) {
    try {
      const subscription =
        await this.subscriptionService.getCurrentSubscription(userId);
      if (!subscription) {
        return successResponse(null, 'No active subscription found for user');
      }
      return successResponse(
        subscription,
        'Current subscription retrieved successfully',
      );
    } catch (error) {
      return errorResponse(error.message);
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get all subscriptions' })
  @ApiResponse({ status: 200, description: 'Return all subscriptions' })
  async findAll() {
    try {
      const subscriptions = await this.subscriptionService.findAll();
      return successResponse(
        subscriptions,
        'All subscriptions retrieved successfully',
      );
    } catch (error) {
      return errorResponse(error.message);
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get subscription by ID' })
  @ApiResponse({ status: 200, description: 'Return subscription details' })
  async findOne(@Param('id') id: string) {
    try {
      const subscription = await this.subscriptionService.findOne(id);
      return successResponse(
        subscription,
        'Subscription retrieved successfully',
      );
    } catch (error) {
      return errorResponse(error.message);
    }
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update subscription' })
  @ApiResponse({
    status: 200,
    description: 'Subscription updated successfully',
  })
  async update(
    @Param('id') id: string,
    @Body() updateSubscriptionDto: UpdateSubscriptionDto,
  ) {
    try {
      const subscription = await this.subscriptionService.update(
        id,
        updateSubscriptionDto,
      );
      return successResponse(subscription, 'Subscription updated successfully');
    } catch (error) {
      return errorResponse(error.message);
    }
  }

  @Patch(':id/use-ai')
  @ApiOperation({ summary: 'Use AI tokens from subscription' })
  @ApiResponse({ status: 200, description: 'AI tokens used successfully' })
  async useAiToken(
    @Param('id') id: string,
    @Body('tokensUsed') tokensUsed: number = 1,
  ) {
    try {
      const subscription = await this.subscriptionService.useAiToken(
        id,
        tokensUsed,
      );
      return successResponse(
        subscription,
        `${tokensUsed} AI token(s) used successfully`,
      );
    } catch (error) {
      return errorResponse(error.message);
    }
  }

  @Patch(':id/use-meeting')
  @ApiOperation({ summary: 'Use meeting from subscription' })
  @ApiResponse({ status: 200, description: 'Meeting used successfully' })
  async useMeeting(@Param('id') id: string) {
    try {
      const subscription = await this.subscriptionService.useMeeting(id);
      return successResponse(subscription, 'Meeting used successfully');
    } catch (error) {
      return errorResponse(error.message);
    }
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel/Delete subscription' })
  @ApiResponse({
    status: 200,
    description: 'Subscription cancelled successfully',
  })
  async remove(@Param('id') id: string) {
    try {
      await this.subscriptionService.remove(id);
      return successResponse(null, 'Subscription cancelled successfully');
    } catch (error) {
      return errorResponse(error.message);
    }
  }
}
