import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
const PayOS = require('@payos/node');
import { Payment, PaymentDocument } from './entities/payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { SubscriptionService } from '../subscription/subscription.service';

@Injectable()
export class PaymentService {
  private payOS: any;

  constructor(
    @InjectModel(Payment.name)
    private paymentModel: Model<PaymentDocument>,
    private subscriptionService: SubscriptionService,
    private configService: ConfigService,
  ) {
    this.payOS = new PayOS(
      this.configService.get('PAYOS_CLIENT_ID') || '',
      this.configService.get('PAYOS_API_KEY') || '',
      this.configService.get('PAYOS_CHECKSUM_KEY') || '',
    );
  }

  async createPayment(userId: string, createPaymentDto: CreatePaymentDto) {
    try {
      let subscription: any;

      // If planId is provided, create subscription first
      if (createPaymentDto.planId) {
        subscription = await this.subscriptionService.purchaseSubscription(
          userId,
          {
            planId: createPaymentDto.planId,
          },
        );
      }
      // If subscriptionId is provided, get existing subscription
      else if (createPaymentDto.subscriptionId) {
        subscription = await this.subscriptionService.findOne(
          createPaymentDto.subscriptionId,
        );
      }
      // Neither provided
      else {
        throw new BadRequestException(
          'Either planId or subscriptionId must be provided',
        );
      }

      if (!subscription) {
        throw new NotFoundException('Subscription not found');
      }

      // Convert userId to ObjectId for comparison
      const userObjectId = new Types.ObjectId(userId);
      if (!subscription.userId.equals(userObjectId)) {
        throw new BadRequestException(
          'Subscription does not belong to this user',
        );
      }

      if (subscription.status !== 'pending') {
        throw new BadRequestException('Subscription is not pending payment');
      }

      // Create payment record
      const payment = new this.paymentModel({
        userId,
        subscriptionId: (subscription as any)._id,
        amount: subscription.totalAmount,
        currency: 'VND',
        status: 'pending',
        paymentMethod: 'payos',
        description:
          createPaymentDto.description ||
          `Payment for ${subscription.planName}`,
      });

      const savedPayment = await payment.save();

      // Create PayOS payment link
      const orderCode = Date.now();
      const payosData = {
        orderCode: orderCode,
        amount: subscription.totalAmount,
        description: savedPayment.description,
        returnUrl: `${this.configService.get('PAYOS_RETURN_URL')}?orderCode=${orderCode}&subscriptionId=${(subscription as any)._id}`,
        cancelUrl: `${this.configService.get('PAYOS_CANCEL_URL')}?orderCode=${orderCode}`,
        items: [
          {
            name: subscription.planName,
            quantity: 1,
            price: subscription.totalAmount,
          },
        ],
      };

      const paymentLinkResponse = await this.payOS.createPaymentLink(payosData);

      // Update payment with PayOS order code
      savedPayment.payosOrderCode = orderCode.toString();
      savedPayment.payosResponse = paymentLinkResponse;
      await savedPayment.save();

      return {
        paymentId: savedPayment._id,
        paymentUrl: paymentLinkResponse.checkoutUrl,
        orderCode: orderCode,
        amount: subscription.totalAmount,
        description: savedPayment.description,
        subscriptionId: (subscription as any)._id,
      };
    } catch (error) {
      throw new BadRequestException(
        `Payment creation failed: ${error.message}`,
      );
    }
  }

  async handlePayOSWebhook(webhookData: any) {
    try {
      console.log('🔔 === PAYOS WEBHOOK RECEIVED ===');
      console.log('📋 Raw webhook data:', JSON.stringify(webhookData, null, 2));
      console.log('📊 Webhook data type:', typeof webhookData);
      console.log('🔍 Webhook keys:', Object.keys(webhookData));

      const { orderCode, code, desc, data } = webhookData;

      console.log('📦 Extracted values:');
      console.log('  - orderCode:', orderCode, '(type:', typeof orderCode, ')');
      console.log('  - code:', code, '(type:', typeof code, ')');
      console.log('  - desc:', desc);
      console.log('  - data:', data);

      // Find payment by order code
      const payment = await this.paymentModel.findOne({
        payosOrderCode: orderCode.toString(),
      });

      console.log('💳 Payment found in DB:', payment ? 'YES' : 'NO');
      if (payment) {
        console.log('💳 Payment details:', {
          id: payment._id,
          status: payment.status,
          amount: payment.amount,
          orderCode: payment.payosOrderCode,
        });
      }

      if (!payment) {
        console.error('❌ Payment not found for orderCode:', orderCode);
        throw new NotFoundException('Payment not found');
      }

      if (code === '00') {
        console.log('✅ Payment successful - code === "00"');
        // Payment successful - use 'completed' status
        payment.status = 'completed';
        payment.payosTransactionId =
          data?.transactionDateTime || Date.now().toString();
        payment.paidAt = new Date();

        // Update payosResponse with new status and webhook data
        payment.payosResponse = {
          ...payment.payosResponse,
          status: 'PAID', // Update the status in payosResponse
          webhook: webhookData,
          updatedAt: new Date().toISOString(),
        };

        const savedPayment = await payment.save();
        console.log('💾 Payment updated successfully:', savedPayment._id);

        // Activate subscription
        console.log('🔄 Activating subscription...');
        await this.subscriptionService.activateSubscription(
          payment.subscriptionId.toString(),
          (payment as any)._id.toString(),
        );
        console.log('✅ Subscription activated successfully');

        return { success: true, message: 'Payment processed successfully' };
      } else {
        console.log('❌ Payment failed - code:', code);
        // Payment failed
        payment.status = 'failed';
        payment.payosResponse = {
          ...payment.payosResponse,
          status: 'FAILED', // Update status in payosResponse
          webhook: webhookData,
          updatedAt: new Date().toISOString(),
        };
        await payment.save();
        console.log('💾 Payment marked as failed');

        return { success: false, message: 'Payment failed' };
      }
    } catch (error) {
      console.error('🚨 Webhook processing error:', error);
      console.error('🚨 Error stack:', error.stack);
      throw new BadRequestException(
        `Webhook processing failed: ${error.message}`,
      );
    }
  }

  async handlePayOSReturn(orderCode: string) {
    try {
      // Get payment info from PayOS
      const paymentInfo = await this.payOS.getPaymentLinkInformation(
        parseInt(orderCode),
      );

      const payment = await this.paymentModel.findOne({
        payosOrderCode: orderCode,
      });

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      if (paymentInfo.status === 'PAID') {
        payment.status = 'completed'; // Use 'completed' instead of 'PAID'
        payment.paidAt = new Date();
        payment.payosResponse = {
          ...payment.payosResponse,
          status: 'PAID', // Update status in payosResponse
          return: paymentInfo,
          updatedAt: new Date().toISOString(),
        };
        await payment.save();

        // Activate subscription
        await this.subscriptionService.activateSubscription(
          payment.subscriptionId.toString(),
          (payment as any)._id.toString(),
        );

        return {
          success: true,
          message: 'Payment completed successfully',
          subscriptionId: payment.subscriptionId,
        };
      } else {
        return {
          success: false,
          message: 'Payment not completed',
          status: paymentInfo.status,
        };
      }
    } catch (error) {
      throw new BadRequestException(
        `Return processing failed: ${error.message}`,
      );
    }
  }

  async getPaymentStatus(paymentId: string) {
    const payment = await this.paymentModel
      .findById(paymentId)
      .populate('subscriptionId')
      .populate('userId', 'fullName email');

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  async debugGetRawPayment(orderCode: string) {
    console.log('🔍 Debug: Querying payment with orderCode:', orderCode);

    const payment = await this.paymentModel
      .findOne({ payosOrderCode: orderCode })
      .lean() // Get raw object without Mongoose transformations
      .exec();

    console.log('📋 Debug: Found payment:', payment);

    if (!payment) {
      // Check all payments to see what's available
      const allPayments = await this.paymentModel
        .find({})
        .select('payosOrderCode status amount')
        .lean()
        .exec();

      console.log('📋 Debug: All payments in DB:', allPayments);
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  async getPaymentByOrderCode(orderCode: string) {
    console.log('🔍 Getting payment for orderCode:', orderCode);

    const payment = await this.paymentModel
      .findOne({ payosOrderCode: orderCode })
      .populate('subscriptionId')
      .populate('userId', 'fullName email')
      .exec();

    console.log('📋 Found payment with status:', payment?.status);

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    const result = {
      paymentId: payment._id,
      status: payment.status,
      amount: payment.amount,
      description: payment.description,
      subscription: payment.subscriptionId,
      paidAt: payment.paidAt,
      orderCode: payment.payosOrderCode,
      rawStatus: payment.status, // Add raw status for debugging
    };

    console.log('📤 Returning payment result:', result);

    return result;
  }

  async checkSubscriptionPaymentStatus(subscriptionId: string) {
    const subscription = await this.subscriptionService.findOne(subscriptionId);

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    const payment = await this.paymentModel
      .findOne({ subscriptionId })
      .sort({ createdAt: -1 });

    return {
      subscriptionStatus: subscription.status,
      paymentStatus: payment ? payment.status : 'no_payment',
      paymentId: payment ? payment._id : null,
      isActive: subscription.status === 'active',
    };
  }

  async verifyPaymentManually(orderCode: string) {
    try {
      console.log('=== MANUAL VERIFICATION START ===');
      console.log('OrderCode:', orderCode);

      // First check if payment exists in DB
      const existingPayment = await this.paymentModel.findOne({
        payosOrderCode: orderCode,
      });

      console.log('Existing payment in DB:', existingPayment);

      if (!existingPayment) {
        throw new NotFoundException('Payment not found in database');
      }

      // Get real payment info from PayOS
      const paymentInfo = await this.payOS.getPaymentLinkInformation(
        parseInt(orderCode),
      );

      console.log('PayOS payment info:', JSON.stringify(paymentInfo, null, 2));
      console.log('Current payment status in DB:', existingPayment.status);
      console.log('PayOS payment status:', paymentInfo.status);

      // If PayOS shows payment as completed, use real webhook data
      if (paymentInfo.status === 'PAID') {
        console.log(
          '🔄 Payment is PAID on PayOS, processing with real data...',
        );

        // Check if there's actual transaction data in PayOS response
        if (paymentInfo.transactions && paymentInfo.transactions.length > 0) {
          console.log('📋 Found real transaction data');

          // Use real transaction data from PayOS
          const transaction = paymentInfo.transactions[0];
          const realWebhookData = {
            orderCode: parseInt(orderCode),
            code: '00', // Success code
            desc: 'success',
            data: {
              orderCode: parseInt(orderCode),
              amount: paymentInfo.amount,
              description: paymentInfo.description,
              accountNumber: paymentInfo.accountNumber,
              reference: transaction.reference || paymentInfo.reference,
              transactionDateTime:
                transaction.transactionDateTime ||
                paymentInfo.transactionDateTime,
              currency: paymentInfo.currency,
              paymentLinkId: paymentInfo.paymentLinkId,
              code: '00',
              desc: 'success',
              counterAccountBankId: transaction.counterAccountBankId,
              counterAccountBankName: transaction.counterAccountBankName,
              counterAccountName: transaction.counterAccountName,
              counterAccountNumber: transaction.counterAccountNumber,
              virtualAccountName:
                transaction.virtualAccountName ||
                paymentInfo.virtualAccountName,
              virtualAccountNumber:
                transaction.virtualAccountNumber ||
                paymentInfo.virtualAccountNumber,
            },
          };

          console.log(
            '📋 Real webhook data from PayOS:',
            JSON.stringify(realWebhookData, null, 2),
          );

          // Process the real webhook
          const webhookResult = await this.handlePayOSWebhook(realWebhookData);

          console.log('✅ Real webhook processing result:', webhookResult);

          if (webhookResult.success) {
            return {
              success: true,
              message:
                'Payment verified and activated successfully with real PayOS data',
              paymentStatus: 'completed',
              subscriptionId: existingPayment.subscriptionId,
              webhookProcessed: true,
              realData: true,
            };
          } else {
            throw new Error('Real webhook processing failed');
          }
        } else {
          // No transaction data yet, but PayOS shows PAID - use basic info
          console.log('⚠️ PayOS shows PAID but no transaction details yet');

          const basicWebhookData = {
            orderCode: parseInt(orderCode),
            code: '00',
            desc: 'success',
            data: {
              orderCode: parseInt(orderCode),
              amount: paymentInfo.amount,
              description: paymentInfo.description,
              transactionDateTime: new Date().toISOString(),
              currency: paymentInfo.currency || 'VND',
              paymentLinkId: paymentInfo.paymentLinkId,
              code: '00',
              desc: 'success',
            },
          };

          console.log(
            '📋 Basic webhook data (no transaction details):',
            JSON.stringify(basicWebhookData, null, 2),
          );

          const webhookResult = await this.handlePayOSWebhook(basicWebhookData);

          if (webhookResult.success) {
            return {
              success: true,
              message:
                'Payment verified and activated successfully (basic PayOS data)',
              paymentStatus: 'completed',
              subscriptionId: existingPayment.subscriptionId,
              webhookProcessed: true,
              realData: true,
              note: 'Transaction details not available yet from PayOS',
            };
          } else {
            throw new Error('Webhook processing failed');
          }
        }
      } else {
        // PayOS status is not PAID yet
        return {
          success: false,
          message: `Payment not completed on PayOS. Current status: ${paymentInfo.status}`,
          paymentStatus: paymentInfo.status,
          dbStatus: existingPayment.status,
          payosData: paymentInfo,
        };
      }
    } catch (error) {
      console.error('Manual verification error:', error);
      throw new BadRequestException(
        `Manual verification failed: ${error.message}`,
      );
    }
  }
}
