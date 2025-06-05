import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { Review, ReviewDocument } from './entities/review.entity';
import { ProductsService } from '../products/products.service';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    @Inject(forwardRef(() => ProductsService))
    private productsService: ProductsService,
  ) {}

  async create(
    createReviewDto: CreateReviewDto,
    userId: string,
  ): Promise<ReviewDocument> {
    try {
      // Check if user already reviewed this product
      const existingReview = await this.reviewModel.findOne({
        userId: new Types.ObjectId(userId),
        productId: new Types.ObjectId(createReviewDto.productId),
      });

      if (existingReview) {
        throw new BadRequestException('User has already reviewed this product');
      }

      const newReview = new this.reviewModel({
        ...createReviewDto,
        userId: new Types.ObjectId(userId),
        productId: new Types.ObjectId(createReviewDto.productId),
      });

      const savedReview = await newReview.save();

      // Update product rating statistics
      await this.updateProductRatingStats(createReviewDto.productId);

      return savedReview;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to create review: ${error.message}`,
      );
    }
  }

  async findAll(filters?: any): Promise<ReviewDocument[]> {
    const query: any = { isActive: true };

    if (filters?.productId) {
      if (!Types.ObjectId.isValid(filters.productId)) {
        throw new BadRequestException('Invalid product ID format');
      }
      query.productId = new Types.ObjectId(filters.productId);
    }

    if (filters?.userId) {
      if (!Types.ObjectId.isValid(filters.userId)) {
        throw new BadRequestException('Invalid user ID format');
      }
      query.userId = new Types.ObjectId(filters.userId);
    }

    if (filters?.rating) {
      query.rating = Number(filters.rating);
    }

    if (filters?.isVerified !== undefined) {
      query.isVerified = filters.isVerified === 'true';
    }

    return this.reviewModel
      .find(query)
      .populate('userId', 'fullName avatarUrl')
      .populate('productId', 'productName productImages brand')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string): Promise<ReviewDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid review ID format');
    }

    const review = await this.reviewModel
      .findById(id)
      .populate('userId', 'fullName avatarUrl')
      .populate('productId', 'productName productImages brand')
      .exec();

    if (!review) {
      throw new NotFoundException(`Review with ID ${id} not found`);
    }
    return review;
  }

  async findByProduct(productId: string): Promise<ReviewDocument[]> {
    if (!Types.ObjectId.isValid(productId)) {
      throw new BadRequestException('Invalid product ID format');
    }

    return this.reviewModel
      .find({
        productId: new Types.ObjectId(productId),
        isActive: true,
      })
      .populate('userId', 'fullName avatarUrl')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByUser(userId: string): Promise<ReviewDocument[]> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    return this.reviewModel
      .find({
        userId: new Types.ObjectId(userId),
        isActive: true,
      })
      .populate('productId', 'productName productImages brand')
      .sort({ createdAt: -1 })
      .exec();
  }

  async update(
    id: string,
    updateReviewDto: UpdateReviewDto,
    userId: string,
  ): Promise<ReviewDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid review ID format');
    }

    const review = await this.reviewModel.findById(id).exec();
    if (!review) {
      throw new NotFoundException(`Review with ID ${id} not found`);
    }

    // Check if user owns this review
    if (review.userId.toString() !== userId) {
      throw new BadRequestException('You can only update your own reviews');
    }

    const updatedReview = await this.reviewModel
      .findByIdAndUpdate(id, updateReviewDto, { new: true })
      .populate('userId', 'fullName avatarUrl')
      .populate('productId', 'productName productImages brand')
      .exec();

    if (!updatedReview) {
      throw new NotFoundException(`Failed to update review with ID ${id}`);
    }

    // Update product rating if rating changed
    if (updateReviewDto.rating) {
      await this.updateProductRatingStats(review.productId.toString());
    }

    return updatedReview;
  }

  async remove(id: string, userId: string): Promise<{ deleted: boolean }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid review ID format');
    }

    const review = await this.reviewModel.findById(id).exec();
    if (!review) {
      throw new NotFoundException(`Review with ID ${id} not found`);
    }

    // Check if user owns this review
    if (review.userId.toString() !== userId) {
      throw new BadRequestException('You can only delete your own reviews');
    }

    const productId = review.productId.toString();
    const result = await this.reviewModel.deleteOne({ _id: id });

    // Update product rating after deletion
    await this.updateProductRatingStats(productId);

    return { deleted: result.deletedCount > 0 };
  }

  async toggleVerified(id: string): Promise<ReviewDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid review ID format');
    }

    const review = await this.reviewModel.findById(id).exec();
    if (!review) {
      throw new NotFoundException(`Review with ID ${id} not found`);
    }

    review.isVerified = !review.isVerified;
    return await review.save();
  }

  async getProductRatingStats(productId: string) {
    if (!Types.ObjectId.isValid(productId)) {
      throw new BadRequestException('Invalid product ID format');
    }

    const stats = await this.reviewModel.aggregate([
      {
        $match: {
          productId: new Types.ObjectId(productId),
          isActive: true,
        },
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          ratingDistribution: {
            $push: '$rating',
          },
        },
      },
      {
        $project: {
          _id: 0,
          averageRating: { $round: ['$averageRating', 1] },
          totalReviews: 1,
          ratingDistribution: {
            1: {
              $size: {
                $filter: {
                  input: '$ratingDistribution',
                  cond: { $eq: ['$$this', 1] },
                },
              },
            },
            2: {
              $size: {
                $filter: {
                  input: '$ratingDistribution',
                  cond: { $eq: ['$$this', 2] },
                },
              },
            },
            3: {
              $size: {
                $filter: {
                  input: '$ratingDistribution',
                  cond: { $eq: ['$$this', 3] },
                },
              },
            },
            4: {
              $size: {
                $filter: {
                  input: '$ratingDistribution',
                  cond: { $eq: ['$$this', 4] },
                },
              },
            },
            5: {
              $size: {
                $filter: {
                  input: '$ratingDistribution',
                  cond: { $eq: ['$$this', 5] },
                },
              },
            },
          },
        },
      },
    ]);

    return (
      stats[0] || {
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      }
    );
  }

  private async updateProductRatingStats(productId: string): Promise<void> {
    try {
      const stats = await this.getProductRatingStats(productId);

      // Only update if ProductsService is available (to avoid circular dependency issues)
      if (this.productsService && this.productsService.updateProductRating) {
        await this.productsService.updateProductRating(
          productId,
          stats.averageRating,
          stats.totalReviews,
        );
      }
    } catch (error) {
      console.error('Failed to update product rating stats:', error);
      // Don't throw error to avoid breaking review operations
    }
  }
}
