import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { successResponse, errorResponse } from '../helper/response.helper';

@ApiTags('payments')
@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('create')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create payment for subscription' })
  @ApiResponse({
    status: 201,
    description: 'Payment link created successfully',
  })
  async createPayment(
    @Request() req,
    @Body() createPaymentDto: CreatePaymentDto,
  ) {
    try {
      const userId = req.user.sub || req.user.id;
      const payment = await this.paymentService.createPayment(
        userId,
        createPaymentDto,
      );
      return successResponse(payment, 'Payment link created successfully', 201);
    } catch (error) {
      return errorResponse(error.message);
    }
  }

  @Post('payos/webhook')
  @ApiOperation({ summary: 'PayOS webhook endpoint' })
  async handlePayOSWebhook(@Body() webhookData: any) {
    try {
      console.log('📞 Webhook endpoint called');
      console.log('📨 Request body:', JSON.stringify(webhookData, null, 2));

      const result = await this.paymentService.handlePayOSWebhook(webhookData);

      console.log('📤 Webhook response:', result);
      return successResponse(result, 'Webhook processed successfully');
    } catch (error) {
      console.error('🚨 Webhook controller error:', error.message);
      return errorResponse(error.message);
    }
  }

  @Get('payos/return')
  @ApiOperation({ summary: 'PayOS return URL endpoint' })
  async handlePayOSReturn(@Query('orderCode') orderCode: string) {
    try {
      console.log('🔙 Return URL called with orderCode:', orderCode);
      const result = await this.paymentService.handlePayOSReturn(orderCode);
      console.log('📤 Return response:', result);
      return successResponse(result, 'Payment return processed');
    } catch (error) {
      console.error('🚨 Return URL error:', error.message);
      return errorResponse(error.message);
    }
  }

  @Post('verify/:orderCode')
  @ApiOperation({
    summary: 'Manually verify payment status with PayOS and process webhook',
    description:
      'Checks PayOS payment status and processes webhook if payment is completed',
  })
  async verifyPaymentManually(@Param('orderCode') orderCode: string) {
    try {
      console.log('🔍 Manual verification requested for orderCode:', orderCode);
      const result = await this.paymentService.verifyPaymentManually(orderCode);

      if (result.success) {
        return successResponse(
          result,
          'Payment verification and webhook processing completed successfully',
        );
      } else {
        return successResponse(
          result,
          'Payment verification completed - no action needed',
        );
      }
    } catch (error) {
      console.error('🚨 Manual verification error:', error.message);
      return errorResponse(error.message);
    }
  }

  @Get('status/:paymentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment status' })
  async getPaymentStatus(@Param('paymentId') paymentId: string) {
    try {
      const payment = await this.paymentService.getPaymentStatus(paymentId);
      return successResponse(payment, 'Payment status retrieved successfully');
    } catch (error) {
      return errorResponse(error.message);
    }
  }

  @Get('check-status/:orderCode')
  @ApiOperation({ summary: 'Check payment status by order code (for mobile)' })
  async checkPaymentStatus(@Param('orderCode') orderCode: string) {
    try {
      console.log('Received orderCode:', orderCode);
      const payment =
        await this.paymentService.getPaymentByOrderCode(orderCode);
      return successResponse(payment, 'Payment status retrieved successfully');
    } catch (error) {
      console.error('Error checking payment status:', error.message);
      return errorResponse(error.message);
    }
  }

  @Get('check-subscription/:subscriptionId')
  @ApiOperation({ summary: 'Check payment status by subscription ID' })
  async checkPaymentBySubscriptionId(
    @Param('subscriptionId') subscriptionId: string,
  ) {
    try {
      const result =
        await this.paymentService.checkSubscriptionPaymentStatus(
          subscriptionId,
        );
      return successResponse(
        result,
        'Subscription payment status retrieved successfully',
      );
    } catch (error) {
      return errorResponse(error.message);
    }
  }

  @Get('debug/payment/:orderCode')
  @ApiOperation({ summary: 'Debug: Get raw payment data from database' })
  async debugGetPayment(@Param('orderCode') orderCode: string) {
    try {
      console.log('🔍 Debug: Looking for orderCode:', orderCode);

      // Raw MongoDB query
      const payment = await this.paymentService.debugGetRawPayment(orderCode);

      console.log(
        '📋 Debug: Raw payment from DB:',
        JSON.stringify(payment, null, 2),
      );

      return successResponse(payment, 'Raw payment data retrieved');
    } catch (error) {
      console.error('🚨 Debug error:', error);
      return errorResponse(error.message);
    }
  }

  //   @Post('refresh/:orderCode')
  //   @ApiOperation({ summary: 'Refresh payment status and sync with PayOS' })
  //   async refreshPaymentStatus(@Param('orderCode') orderCode: string) {
  //     try {
  //       const result = await this.paymentService.refreshPaymentStatus(orderCode);
  //       return successResponse(result, 'Payment status refreshed successfully');
  //     } catch (error) {
  //       return errorResponse(error.message);
  //     }
  //   }

  //   @Get('debug/all-payments')
  //   @ApiOperation({ summary: 'Debug: Get all payments (limit 10)' })
  //   async debugGetAllPayments() {
  //     try {
  //       const payments = await this.paymentService.debugGetAllPayments();
  //       return successResponse(payments, 'All payments retrieved for debug');
  //     } catch (error) {
  //       return errorResponse(error.message);
  //     }
  //   }

  //   @Get('debug/find-by-subscription/:subscriptionId')
  //   @ApiOperation({ summary: 'Debug: Find payments by subscription ID' })
  //   async debugFindBySubscription(
  //     @Param('subscriptionId') subscriptionId: string,
  //   ) {
  //     try {
  //       const payments =
  //         await this.paymentService.debugFindPaymentBySubscription(
  //           subscriptionId,
  //         );
  //       return successResponse(payments, 'Payments found for subscription');
  //     } catch (error) {
  //       return errorResponse(error.message);
  //     }
  //   }
}
