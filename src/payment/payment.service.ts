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

      // Sinh mã đơn hàng duy nhất (orderCode) với tiền tố ORD và 3-6 ký tự số
      let orderCode = '';
      let isUnique = false;
      while (!isUnique) {
        const randomLength = Math.floor(Math.random() * 4) + 3; // 3-6 ký tự
        const randomNumber = Math.floor(
          Math.random() * Math.pow(10, randomLength),
        )
          .toString()
          .padStart(randomLength, '0');
        orderCode = `ORD${randomNumber}`;
        // Kiểm tra trùng lặp trong DB
        const existing = await this.paymentModel.findOne({ orderCode });
        if (!existing) isUnique = true;
      }

      const userIdObjId = new Types.ObjectId(userId);
      console.log('Creating payment for user:', userIdObjId);

      // Tạo payment record
      const payment = new this.paymentModel({
        userId: userIdObjId,
        subscriptionId: subscription._id,
        amount: subscription.totalAmount,
        currency: 'VND',
        status: 'pending',
        paymentMethod: 'sepay',
        description:
          createPaymentDto.description ||
          `Payment for ${subscription.planName}`,
        orderCode: orderCode || '', // Đảm bảo orderCode luôn có giá trị
      });

      const savedPayment = await payment.save();
      // Trả về thông tin tài khoản nhận, nội dung chuyển khoản cho FE

      console.log('Payment: ', {
        paymentId: savedPayment._id,
        amount: subscription.totalAmount,
        description: savedPayment.description,
        subscriptionId: subscription._id,
        orderCode: savedPayment.orderCode,
        bankAccount: '0908705620', // Thay bằng số tài khoản nhận thật
        bankName: 'MB', // Thay bằng tên ngân hàng thật
        accountName: 'PHAM NGUYEN VU', // Thay bằng tên chủ tài khoản thật
        transferContent: savedPayment.orderCode, // FE sẽ hiển thị nội dung này cho user copy khi chuyển khoản
      });

      return {
        paymentId: savedPayment._id,
        amount: subscription.totalAmount,
        description: savedPayment.description,
        subscriptionId: subscription._id,
        orderCode: savedPayment.orderCode,
        bankAccount: '0908705620', // Thay bằng số tài khoản nhận thật
        bankName: 'MB', // Thay bằng tên ngân hàng thật
        accountName: 'PHAM NGUYEN VU', // Thay bằng tên chủ tài khoản thật
        transferContent: savedPayment.orderCode, // FE sẽ hiển thị nội dung này cho user copy khi chuyển khoản
      };
    } catch (error) {
      throw new BadRequestException(
        `Payment creation failed: ${error.message}`,
      );
    }
  }

  // Mapping nâng cao khi nhận webhook từ SePay
  // Tìm payment dựa trên orderCode (nội dung chuyển khoản), số tiền, trạng thái pending
  async handleSepayWebhook(webhookData: any, authHeader: string) {
    try {
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
      // Mapping nâng cao: tìm payment theo orderCode từ code hoặc nằm trong content, số tiền, trạng thái pending
      const orderCode = webhookData.code || '';
      let payment: PaymentDocument | null = null;
      if (orderCode) {
        payment = await this.paymentModel.findOne({
          orderCode: orderCode,
          amount: webhookData.transferAmount,
          status: 'pending',
        });
      }
      if (!payment) {
        const content = webhookData.content || '';
        if (content) {
          payment = await this.paymentModel.findOne({
            orderCode: { $regex: new RegExp(orderCode || content, 'i') },
            amount: webhookData.transferAmount,
            status: 'pending',
          });
        }
      }
      if (!payment) {
        // Nếu không tìm thấy payment, tự tạo mới với trạng thái completed
        const newPayment = new this.paymentModel({
          userId: null, // Không xác định được user
          subscriptionId: null, // Không xác định được subscription
          amount: webhookData.transferAmount,
          currency: 'VND',
          status: webhookData.transferType === 'in' ? 'completed' : 'pending',
          paymentMethod: 'sepay',
          description:
            webhookData.description || 'Auto-created from SePay webhook',
          paidAt:
            webhookData.transferType === 'in'
              ? new Date(webhookData.transactionDate)
              : null,
          orderCode: webhookData.code || '',
          sepayId: webhookData.id,
          sepayReferenceCode: webhookData.referenceCode,
          sepayWebhook: webhookData,
        });
        await newPayment.save();
        // (Tùy chọn) Gửi thông báo cho admin tại đây
        return { success: true, message: 'Auto-created payment from webhook' };
      }
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
      .findOne({ orderCode: orderCode })
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

  async getAllPayments(page: number = 1, limit: number = 10, status?: string, search?: string) {
    const skip = (page - 1) * limit;
    const filter: any = {};

    if (status) {
      filter.status = status;
    }

    // Add search functionality
    if (search) {
      filter.$or = [
        { description: { $regex: search, $options: 'i' } },
        { paymentId: { $regex: search, $options: 'i' } },
      ];

      // If search term looks like a MongoDB ObjectId, also search by _id
      if (search.match(/^[0-9a-fA-F]{24}$/)) {
        filter.$or.push({ _id: search });
      }
    }

    const payments = await this.paymentModel
      .find(filter)
      .populate('subscriptionId')
      .populate('userId', 'fullName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    const total = await this.paymentModel.countDocuments(filter);

    return {
      payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getPaymentsByUserId(userId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const payments = await this.paymentModel
      .find({ userId })
      .populate('subscriptionId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    const total = await this.paymentModel.countDocuments({ userId });

    return {
      payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getPaymentById(paymentId: string) {
    const payment = await this.paymentModel
      .findById(paymentId)
      .populate('subscriptionId')
      .populate('userId', 'fullName email')
      .exec();

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  async getPaymentsByStatus(status: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const payments = await this.paymentModel
      .find({ status })
      .populate('subscriptionId')
      .populate('userId', 'fullName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    const total = await this.paymentModel.countDocuments({ status });

    return {
      payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getPaymentStatistics() {
    const totalPayments = await this.paymentModel.countDocuments();
    const completedPayments = await this.paymentModel.countDocuments({
      status: 'completed',
    });
    const pendingPayments = await this.paymentModel.countDocuments({
      status: 'pending',
    });
    const failedPayments = await this.paymentModel.countDocuments({
      status: 'failed',
    });

    const totalRevenue = await this.paymentModel.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    return {
      totalPayments,
      completedPayments,
      pendingPayments,
      failedPayments,
      totalRevenue: totalRevenue[0]?.total || 0,
    };
  }
}
