import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AddReviewDto } from './dto/add-review.dto';
import { Product, ProductDocument } from './entities/product.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
  ) {}

  async create(createProductDto: CreateProductDto): Promise<ProductDocument> {
    try {
      const newProduct = new this.productModel({
        ...createProductDto,
        expiryDate: createProductDto.expiryDate
          ? new Date(createProductDto.expiryDate)
          : undefined,
        promotionId: createProductDto.promotionId
          ? new Types.ObjectId(createProductDto.promotionId)
          : undefined,
        categories: createProductDto.categories
          ? createProductDto.categories.map((cat) => new Types.ObjectId(cat))
          : [],
      });
      return await newProduct.save();
    } catch (error) {
      throw new BadRequestException(
        `Failed to create product: ${error.message}`,
      );
    }
  }

  async findAll(filters?: any): Promise<ProductDocument[]> {
    const query: any = { isActive: true };

    if (filters?.category) {
      query.categories = { $in: [new Types.ObjectId(filters.category)] };
    }
    if (filters?.brand) {
      query.brand = new RegExp(filters.brand, 'i');
    }
    if (filters?.suitableFor) {
      query.suitableFor = new RegExp(filters.suitableFor, 'i');
    }
    if (filters?.minPrice || filters?.maxPrice) {
      query.price = {};
      if (filters.minPrice) query.price.$gte = Number(filters.minPrice);
      if (filters.maxPrice) query.price.$lte = Number(filters.maxPrice);
    }

    return this.productModel
      .find(query)
      .populate('promotionId')
      .populate('categories')
      .exec();
  }

  async findOne(id: string): Promise<ProductDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid product ID format');
    }

    const product = await this.productModel
      .findById(id)
      .populate('promotionId')
      .populate('categories')
      .populate('reviews.userId', 'fullName avatarUrl')
      .exec();

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<ProductDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid product ID format');
    }

    const updateData: any = { ...updateProductDto };

    if (updateProductDto.expiryDate) {
      updateData.expiryDate = new Date(updateProductDto.expiryDate);
    }

    if (updateProductDto.promotionId) {
      updateData.promotionId = new Types.ObjectId(updateProductDto.promotionId);
    }

    if (updateProductDto.categories) {
      updateData.categories = updateProductDto.categories.map(
        (cat) => new Types.ObjectId(cat),
      );
    }

    const product = await this.productModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .populate('promotionId')
      .populate('categories')
      .exec();

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid product ID format');
    }

    const result = await this.productModel.deleteOne({ _id: id });
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return { deleted: true };
  }

  async addReview(
    productId: string,
    userId: string,
    addReviewDto: AddReviewDto,
  ): Promise<ProductDocument> {
    if (!Types.ObjectId.isValid(productId)) {
      throw new BadRequestException('Invalid product ID format');
    }

    const product = await this.productModel.findById(productId).exec();
    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    // Check if user already reviewed this product
    const existingReview = product.reviews.find(
      (review) => review.userId.toString() === userId,
    );

    if (existingReview) {
      throw new BadRequestException('User has already reviewed this product');
    }

    const newReview = {
      userId: new Types.ObjectId(userId),
      rating: addReviewDto.rating,
      comment: addReviewDto.comment,
      reviewDate: new Date(),
      isVerified: false,
    };

    product.reviews.push(newReview as any);
    return await product.save();
  }

  async searchProducts(searchTerm: string): Promise<ProductDocument[]> {
    return this.productModel
      .find({
        $and: [
          { isActive: true },
          {
            $or: [
              { productName: { $regex: searchTerm, $options: 'i' } },
              { productDescription: { $regex: searchTerm, $options: 'i' } },
              { brand: { $regex: searchTerm, $options: 'i' } },
            ],
          },
        ],
      })
      .populate('promotionId')
      .populate('categories')
      .exec();
  }

  async getProductsByCategory(categoryId: string): Promise<ProductDocument[]> {
    if (!Types.ObjectId.isValid(categoryId)) {
      throw new BadRequestException('Invalid category ID format');
    }

    return this.productModel
      .find({
        categories: { $in: [new Types.ObjectId(categoryId)] },
        isActive: true,
      })
      .populate('promotionId')
      .populate('categories')
      .exec();
  }

  async getProductsBySkinType(skinType: string): Promise<ProductDocument[]> {
    return this.productModel
      .find({
        suitableFor: { $regex: skinType, $options: 'i' },
        isActive: true,
      })
      .populate('promotionId')
      .populate('categories')
      .exec();
  }

  async getFeaturedProducts(): Promise<ProductDocument[]> {
    return this.productModel
      .find({ isActive: true })
      .sort({ averageRating: -1, totalReviews: -1 })
      .limit(10)
      .populate('promotionId')
      .populate('categories')
      .exec();
  }

  async updateStock(
    productId: string,
    quantity: number,
  ): Promise<ProductDocument> {
    if (!Types.ObjectId.isValid(productId)) {
      throw new BadRequestException('Invalid product ID format');
    }

    const product = await this.productModel.findById(productId).exec();
    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    if (product.stock + quantity < 0) {
      throw new BadRequestException('Insufficient stock');
    }

    product.stock += quantity;
    return await product.save();
  }
}
