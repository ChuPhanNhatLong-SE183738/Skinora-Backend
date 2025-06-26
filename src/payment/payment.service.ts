import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Payment, PaymentDocument } from './entities/payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { SubscriptionService } from '../subscription/subscription.service';

@Injectable()
export class PaymentService {
  constructor(
    @InjectModel(Payment.name)
    private paymentModel: Model<PaymentDocument>,
    private subscriptionService: SubscriptionService,
    private configService: ConfigService,
  ) {}

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

      // Tạo payment record (chưa có link thanh toán, chỉ lưu trạng thái chờ)
      const payment = new this.paymentModel({
        userId,
        subscriptionId: (subscription as any)._id,
        amount: subscription.totalAmount,
        currency: 'VND',
        status: 'pending',
        paymentMethod: 'sepay',
        description:
          createPaymentDto.description ||
          `Payment for ${subscription.planName}`,
      });

      const savedPayment = await payment.save();

      // Trả về thông tin để user chuyển khoản (SePay không tạo link thanh toán như PayOS)
      // Có thể trả về thông tin tài khoản nhận, nội dung chuyển khoản, v.v. nếu cần
      return {
        paymentId: savedPayment._id,
        amount: subscription.totalAmount,
        description: savedPayment.description,
        subscriptionId: (subscription as any)._id,
        // Có thể bổ sung thêm thông tin tài khoản nhận tiền ở đây nếu cần
      };
    } catch (error) {
      throw new BadRequestException(
        `Payment creation failed: ${error.message}`,
      );
    }
  }

  // Xử lý webhook từ SePay
  async handleSepayWebhook(webhookData: any, authHeader: string) {
    try {
      // Kiểm tra API Key nếu cấu hình dùng API Key
      const sepayApiKey = this.configService.get('SEPAY_API_KEY');
      if (sepayApiKey && authHeader !== `Apikey ${sepayApiKey}`) {
        throw new UnauthorizedException('Invalid API Key');
      }

      // Chống trùng lặp giao dịch dựa trên id của SePay
      const existing = await this.paymentModel.findOne({
        sepayId: webhookData.id,
      });
      if (existing) {
        return { success: true, message: 'Already processed' };
      }

      // Tìm payment theo subscriptionId hoặc thông tin khác nếu có
      // (Có thể cần mapping giữa payment và giao dịch SePay dựa trên nội dung chuyển khoản hoặc referenceCode)
      // Ở đây giả sử bạn đã lưu mapping ở chỗ khác, hoặc sẽ cập nhật payment đầu tiên có trạng thái pending
      const payment = await this.paymentModel.findOne({
        subscriptionId: webhookData.subscriptionId, // Cần đảm bảo có trường này hoặc mapping phù hợp
        status: 'pending',
      });

      if (!payment) {
        throw new NotFoundException('Payment not found for webhook');
      }

      // Cập nhật payment với thông tin từ SePay
      payment.status =
        webhookData.transferType === 'in' ? 'completed' : 'pending';
      payment.paidAt =
        webhookData.transferType === 'in'
          ? new Date(webhookData.transactionDate)
          : null;
      payment['sepayId'] = webhookData.id;
      payment['sepayReferenceCode'] = webhookData.referenceCode;
      payment['sepayWebhook'] = webhookData;
      await payment.save();

      // Kích hoạt subscription nếu thanh toán thành công
      if (webhookData.transferType === 'in') {
        await this.subscriptionService.activateSubscription(
          payment.subscriptionId.toString(),
          (payment._id as any).toString(),
        );
      }

      return { success: true };
    } catch (error) {
      throw new BadRequestException(
        `Webhook processing failed: ${error.message}`,
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
      .findOne({ sepayId: orderCode })
      .lean() // Get raw object without Mongoose transformations
      .exec();

    console.log('📋 Debug: Found payment:', payment);

    if (!payment) {
      // Check all payments to see what's available
      const allPayments = await this.paymentModel
        .find({})
        .select('sepayId status amount')
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
      .findOne({ sepayId: orderCode })
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
      orderCode: payment.sepayId,
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
}
