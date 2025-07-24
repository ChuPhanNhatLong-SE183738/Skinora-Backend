import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';
import { Feedback, FeedbackDocument } from './entities/feedback.entity';

@Injectable()
export class FeedbackService {
  constructor(
    @InjectModel(Feedback.name)
    private feedbackModel: Model<FeedbackDocument>,
  ) {}

  async create(
    createFeedbackDto: CreateFeedbackDto,
  ): Promise<FeedbackDocument> {
    try {
      const feedback = new this.feedbackModel({
        ...createFeedbackDto,
        userId: new Types.ObjectId(createFeedbackDto.userId),
      });
      return await feedback.save();
    } catch (error) {
      throw new BadRequestException(
        `Failed to create feedback: ${error.message}`,
      );
    }
  }

  async findAll(filters?: {
    userId?: string;
    rating?: number;
    minRating?: number;
    maxRating?: number;
  }): Promise<FeedbackDocument[]> {
    const query: any = {};

    if (filters?.userId) {
      query.userId = new Types.ObjectId(filters.userId);
    }

    if (filters?.rating) {
      query.rating = filters.rating;
    }

    if (filters?.minRating || filters?.maxRating) {
      query.rating = {};
      if (filters.minRating) {
        query.rating.$gte = filters.minRating;
      }
      if (filters.maxRating) {
        query.rating.$lte = filters.maxRating;
      }
    }

    return await this.feedbackModel
      .find(query)
      .populate('userId', 'fullName email avatarUrl')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string): Promise<FeedbackDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid feedback ID format');
    }

    const feedback = await this.feedbackModel
      .findById(id)
      .populate('userId', 'fullName email profilePicture')
      .exec();

    if (!feedback) {
      throw new NotFoundException(`Feedback with ID ${id} not found`);
    }

    return feedback;
  }

  async findByUser(userId: string): Promise<FeedbackDocument[]> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format');
    }

    return await this.feedbackModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate('userId', 'fullName email profilePicture')
      .sort({ createdAt: -1 })
      .exec();
  }

  async update(
    id: string,
    updateFeedbackDto: UpdateFeedbackDto,
    requestingUserId?: string,
  ): Promise<FeedbackDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid feedback ID format');
    }

    const existingFeedback = await this.findOne(id);

    // Check if the requesting user is the owner of the feedback
    if (
      requestingUserId &&
      existingFeedback.userId.toString() !== requestingUserId
    ) {
      throw new ForbiddenException('You can only update your own feedback');
    }

    const updatedFeedback = await this.feedbackModel
      .findByIdAndUpdate(
        id,
        {
          ...updateFeedbackDto,
          ...(updateFeedbackDto.userId && {
            userId: new Types.ObjectId(updateFeedbackDto.userId),
          }),
        },
        { new: true },
      )
      .populate('userId', 'fullName email profilePicture')
      .exec();

    if (!updatedFeedback) {
      throw new NotFoundException(`Feedback with ID ${id} not found`);
    }

    return updatedFeedback;
  }

  async remove(
    id: string,
    requestingUserId?: string,
  ): Promise<{ deleted: boolean }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid feedback ID format');
    }

    const existingFeedback = await this.findOne(id);

    // Check if the requesting user is the owner of the feedback
    if (
      requestingUserId &&
      existingFeedback.userId.toString() !== requestingUserId
    ) {
      throw new ForbiddenException('You can only delete your own feedback');
    }

    const result = await this.feedbackModel.findByIdAndDelete(id).exec();

    if (!result) {
      throw new NotFoundException(`Feedback with ID ${id} not found`);
    }

    return { deleted: true };
  }

  async getAverageRating(): Promise<{
    averageRating: number;
    totalFeedbacks: number;
  }> {
    const result = await this.feedbackModel.aggregate([
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalFeedbacks: { $sum: 1 },
        },
      },
    ]);

    return result.length > 0
      ? {
          averageRating: Math.round(result[0].averageRating * 100) / 100,
          totalFeedbacks: result[0].totalFeedbacks,
        }
      : { averageRating: 0, totalFeedbacks: 0 };
  }

  async getRatingStats(): Promise<{
    averageRating: number;
    totalFeedbacks: number;
    ratingDistribution: { rating: number; count: number }[];
  }> {
    const [avgResult, distributionResult] = await Promise.all([
      this.getAverageRating(),
      this.feedbackModel.aggregate([
        {
          $group: {
            _id: '$rating',
            count: { $sum: 1 },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]),
    ]);

    return {
      ...avgResult,
      ratingDistribution: distributionResult.map((item) => ({
        rating: item._id,
        count: item.count,
      })),
    };
  }
}
