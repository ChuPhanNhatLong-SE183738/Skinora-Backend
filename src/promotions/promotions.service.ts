import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { Promotion, PromotionDocument } from './entities/promotion.entity';

@Injectable()
export class PromotionsService {
  constructor(
    @InjectModel(Promotion.name)
    private promotionModel: Model<PromotionDocument>,
    @InjectModel('Product') private productModel: Model<any>,
  ) {}

  private async validateProductIds(productIds: string[]): Promise<void> {
    if (!productIds || productIds.length === 0) return;

    const validProducts = await this.productModel
      .find({ _id: { $in: productIds.map((id) => new Types.ObjectId(id)) } })
      .select('_id')
      .exec();

    const foundIds = validProducts.map((p) => p._id.toString());
    const invalidIds = productIds.filter((id) => !foundIds.includes(id));

    if (invalidIds.length > 0) {
      throw new BadRequestException(
        `Product(s) not found: ${invalidIds.join(', ')}`,
      );
    }
  }

  private async validateCategories(categories: string[]): Promise<void> {
    if (!categories || categories.length === 0) return;

    // Get all existing categories from products
    const existingCategories = await this.productModel
      .distinct('category')
      .exec();

    const flattenedCategories = existingCategories.flat();
    const invalidCategories = categories.filter(
      (category) => !flattenedCategories.includes(category),
    );

    if (invalidCategories.length > 0) {
      throw new BadRequestException(
        `Category(ies) not found: ${invalidCategories.join(', ')}`,
      );
    }
  }

  async create(
    createPromotionDto: CreatePromotionDto,
  ): Promise<PromotionDocument> {
    // Validate product IDs
    if (createPromotionDto.applicableProducts) {
      await this.validateProductIds(createPromotionDto.applicableProducts);
    }

    // Validate categories
    if (createPromotionDto.applicableCategories) {
      await this.validateCategories(createPromotionDto.applicableCategories);
    }

    const newPromotion = new this.promotionModel({
      ...createPromotionDto,
      applicableProducts:
        createPromotionDto.applicableProducts?.map(
          (id) => new Types.ObjectId(id),
        ) || [],
      startDate: new Date(createPromotionDto.startDate),
      endDate: new Date(createPromotionDto.endDate),
    });
    return await newPromotion.save();
  }

  async findAll(): Promise<PromotionDocument[]> {
    return this.promotionModel.find().populate('applicableProducts').exec();
  }

  async findActive(): Promise<PromotionDocument[]> {
    const now = new Date();
    return this.promotionModel
      .find({
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
      })
      .populate('applicableProducts')
      .exec();
  }

  async findOne(id: string): Promise<PromotionDocument> {
    const promotion = await this.promotionModel
      .findById(id)
      .populate('applicableProducts')
      .exec();
    if (!promotion) {
      throw new NotFoundException(`Promotion with ID ${id} not found`);
    }
    return promotion;
  }

  async findByPromoCode(promoCode: string): Promise<PromotionDocument> {
    const promotion = await this.promotionModel
      .findOne({
        promoCode,
        isActive: true,
        startDate: { $lte: new Date() },
        endDate: { $gte: new Date() },
      })
      .populate('applicableProducts')
      .exec();

    if (!promotion) {
      throw new NotFoundException(
        `Promotion with code ${promoCode} not found or expired`,
      );
    }
    return promotion;
  }

  async update(
    id: string,
    updatePromotionDto: UpdatePromotionDto,
  ): Promise<PromotionDocument> {
    // Validate product IDs if provided
    if (updatePromotionDto.applicableProducts) {
      await this.validateProductIds(updatePromotionDto.applicableProducts);
    }

    // Validate categories if provided
    if (updatePromotionDto.applicableCategories) {
      await this.validateCategories(updatePromotionDto.applicableCategories);
    }

    const updateData: any = { ...updatePromotionDto };

    if (updatePromotionDto.applicableProducts) {
      updateData.applicableProducts = updatePromotionDto.applicableProducts.map(
        (id) => new Types.ObjectId(id),
      );
    }

    if (updatePromotionDto.startDate) {
      updateData.startDate = new Date(updatePromotionDto.startDate);
    }

    if (updatePromotionDto.endDate) {
      updateData.endDate = new Date(updatePromotionDto.endDate);
    }

    const promotion = await this.promotionModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .populate('applicableProducts')
      .exec();

    if (!promotion) {
      throw new NotFoundException(`Promotion with ID ${id} not found`);
    }
    return promotion;
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const result = await this.promotionModel.deleteOne({ _id: id });
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Promotion with ID ${id} not found`);
    }
    return { deleted: true };
  }

  async incrementUsage(id: string): Promise<PromotionDocument> {
    const promotion = await this.promotionModel
      .findByIdAndUpdate(id, { $inc: { usageCount: 1 } }, { new: true })
      .exec();

    if (!promotion) {
      throw new NotFoundException(`Promotion with ID ${id} not found`);
    }
    return promotion;
  }
}
