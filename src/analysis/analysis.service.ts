import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
// TODO: Re-enable when onnxruntime-node is working in Docker
// import * as ort from 'onnxruntime-node';
import * as sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import { Analysis, AnalysisDocument } from './entities/analysis.entity';
import {
  RecommendedProducts,
  RecommendedProductsDocument,
} from './entities/recommended-products.entity';
import { CreateAnalyseDto } from './dto/create-analyse.dto';
import { UpdateAnalyseDto } from './dto/update-analyse.dto';
import { ProductsService } from '../products/products.service';
// Add this import
import { SubscriptionService } from '../subscription/subscription.service';

export interface AnalyseResult {
  analyseIndex: number;
  skinType: string;
  confidence: number;
}

@Injectable()
export class AnalysisService {
  private modelPath: string;
  private session?: ort.InferenceSession;
  private labels: string[];
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    @InjectModel(Analysis.name) private analysisModel: Model<AnalysisDocument>,
    @InjectModel(RecommendedProducts.name)
    private recommendedProductsModel: Model<RecommendedProductsDocument>,
    @Inject(forwardRef(() => ProductsService))
    private productsService: ProductsService,
    // Add this injection
    @Inject(forwardRef(() => SubscriptionService))
    private subscriptionService: SubscriptionService,
  ) {
    this.modelPath = path.join(
      process.cwd(),
      'models',
      'resnet50_skin_final_1.onnx',
    );
    this.labels = ['Acne', 'Eczema', 'Normal', 'Psoriasis'];
    this.initModel();
  }

  async getUserWeeklyAnalysisCount(
    userId: string,
    since: Date,
  ): Promise<number> {
    // Assuming you have an Analysis mongoose model injected as this.analysisModel
    return this.analysisModel
      .countDocuments({
        userId,
        createdAt: { $gte: since },
      })
      .exec();
  }

  // Add this new method to validate user's analysis eligibility
  async validateUserAnalysisEligibility(
    userId: string,
  ): Promise<{
    canAnalyze: boolean;
    subscriptionId?: string;
    message?: string;
  }> {
    try {
      // First, check if user has an active subscription
      const subscription =
        await this.subscriptionService.getCurrentSubscription(userId);

      if (subscription) {
        // User has a subscription, check if they have available AI tokens
        if (subscription.status === 'active') {
          if (subscription.aiUsageUsed < subscription.aiUsageAmount) {
            return {
              canAnalyze: true,
              subscriptionId: subscription._id.toString(),
              message: `You have ${subscription.aiUsageAmount - subscription.aiUsageUsed} analyses remaining in your subscription.`,
            };
          } else {
            return {
              canAnalyze: false,
              subscriptionId: subscription._id.toString(),
              message: `You have used all available skin analyses in your subscription plan (${subscription.aiUsageUsed}/${subscription.aiUsageAmount}).`,
            };
          }
        } else {
          return {
            canAnalyze: false,
            subscriptionId: subscription._id.toString(),
            message: `Your subscription is not active (current status: ${subscription.status}).`,
          };
        }
      }

      // No active subscription, check weekly free usage
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const weeklyAnalysisCount = await this.getUserWeeklyAnalysisCount(
        userId,
        oneWeekAgo,
      );

      if (weeklyAnalysisCount < 3) {
        return {
          canAnalyze: true,
          message: `Free analysis ${weeklyAnalysisCount + 1}/3 this week. Consider subscribing for unlimited analyses.`,
        };
      } else {
        return {
          canAnalyze: false,
          message:
            'You have used all 3 free weekly skin analyses. Please subscribe to a plan for more analyses.',
        };
      }
    } catch (error) {
      this.logger.error(
        `Error validating analysis eligibility: ${error.message}`,
      );
      throw error;
    }
  }

  private async initModel() {
    try {
      if (fs.existsSync(this.modelPath)) {
        this.session = await ort.InferenceSession.create(this.modelPath);
        this.logger.log('ONNX model initialized successfully');
      } else {
        this.logger.warn('ONNX model file not found, using mock analysis');
      }
    } catch (error) {
      this.logger.error('Error initializing ONNX model:', error);
    }
  }

  async runInference(imageBuffer: Buffer): Promise<AnalyseResult> {
    if (!this.session) {
      // Mock analysis for development
      const mockIndex = Math.floor(Math.random() * this.labels.length);
      return {
        analyseIndex: mockIndex,
        skinType: this.labels[mockIndex],
        confidence: Math.random() * 0.3 + 0.7, // 70-100% confidence
      };
    }

    try {
      const { data } = await sharp(imageBuffer)
        .resize(224, 224)
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const floatData = new Float32Array(3 * 224 * 224);
      const mean = [0.485, 0.456, 0.406];
      const std = [0.229, 0.224, 0.225];

      for (let i = 0; i < 224 * 224; i++) {
        for (let c = 0; c < 3; c++) {
          floatData[c * 224 * 224 + i] =
            (data[i * 3 + c] / 255 - mean[c]) / std[c];
        }
      }

      const inputTensor = new ort.Tensor(
        'float32',
        floatData,
        [1, 3, 224, 224],
      );
      const outputs = await this.session.run({ input: inputTensor });
      const outputData = outputs.output.data as Float32Array;
      const analyseIndex = Array.from(outputData).indexOf(
        Math.max(...Array.from(outputData)),
      );

      return {
        analyseIndex,
        skinType: this.labels[analyseIndex],
        confidence: Math.max(...Array.from(outputData)),
      };
    } catch (error) {
      this.logger.error(`Inference error: ${error.message}`);
      throw new BadRequestException('Failed to analyze image');
    }
  }

  async saveAnalysis(
    createAnalyseDto: CreateAnalyseDto,
  ): Promise<AnalysisDocument> {
    try {
      const newAnalysis = new this.analysisModel({
        userId: new Types.ObjectId(createAnalyseDto.userId),
        imageUrl: createAnalyseDto.imageUrl,
        skinType: createAnalyseDto.skinType,
        result: createAnalyseDto.result,
        analysisDate: new Date(),
      });

      const savedAnalysis = await newAnalysis.save();

      // Save recommended products separately
      if (
        createAnalyseDto.recommendedProducts &&
        createAnalyseDto.recommendedProducts.length > 0
      ) {
        const recommendations = createAnalyseDto.recommendedProducts.map(
          (rec, index) => ({
            recommendationId: `rec-${index + 1}-${Date.now()}`,
            analysisId: savedAnalysis._id,
            productId: new Types.ObjectId(rec.productId),
            reason: rec.reason,
          }),
        );

        await this.recommendedProductsModel.insertMany(recommendations);
      }

      return savedAnalysis;
    } catch (error) {
      this.logger.error(`Error saving analysis: ${error.message}`);
      throw new BadRequestException(
        `Failed to save analysis: ${error.message}`,
      );
    }
  }

  async generateRecommendations(skinType: string): Promise<any[]> {
    try {
      const recommendations: { productId: string; reason: string }[] = [];

      if (this.productsService) {
        // Get products suitable for the detected skin type
        const suitableProducts =
          await this.productsService.getProductsBySkinType(skinType);

        // Also get products from related categories based on skin type
        const categoryFilters = this.getCategoryFiltersBySkinType(skinType);
        let categoryProducts: any[] = [];

        for (const category of categoryFilters) {
          try {
            const productsResult = await this.productsService.findAll({
              suitableFor: category,
            });

            // Handle both array and object with products property
            let products: any[] = [];
            if (Array.isArray(productsResult)) {
              products = productsResult;
            } else if (
              productsResult &&
              typeof productsResult === 'object' &&
              'products' in productsResult
            ) {
              products = (productsResult as any).products || [];
            } else {
              products = [];
            }

            categoryProducts = categoryProducts.concat(products);
          } catch (error) {
            this.logger.warn(
              `Failed to get products for category ${category}: ${error.message}`,
            );
          }
        }

        // Combine and deduplicate products
        const allProducts = [...(suitableProducts || []), ...categoryProducts];
        const uniqueProducts = this.deduplicateProducts(allProducts);

        // Sort by rating and limit to top recommendations
        const sortedProducts = uniqueProducts
          .filter((product) => product.isActive && product.stock > 0)
          .sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0))
          .slice(0, 5); // Limit to top 5 recommendations

        // Generate recommendation reasons based on skin type and product
        for (const product of sortedProducts) {
          const reason = this.generateRecommendationReason(skinType, product);
          recommendations.push({
            productId: product._id.toString(),
            reason: reason,
          });
        }
      }

      // Fallback to mock data if no real products found or ProductsService unavailable
      if (recommendations.length === 0) {
        this.logger.warn(
          'No suitable products found, using fallback recommendations',
        );
        return this.getFallbackRecommendations(skinType);
      }

      return recommendations;
    } catch (error) {
      this.logger.error(`Error generating recommendations: ${error.message}`);
      return this.getFallbackRecommendations(skinType);
    }
  }

  private getCategoryFiltersBySkinType(skinType: string): string[] {
    const categoryMap = {
      Acne: ['acne-prone skin', 'oily skin', 'acne treatment', 'oil control'],
      Eczema: ['sensitive skin', 'dry skin', 'gentle', 'hypoallergenic'],
      Normal: ['all skin types', 'normal skin', 'balanced'],
      Psoriasis: ['sensitive skin', 'dry skin', 'anti-inflammatory', 'gentle'],
    };

    return categoryMap[skinType] || ['all skin types'];
  }

  private deduplicateProducts(products: any[]): any[] {
    const seen = new Set();
    return products.filter((product) => {
      const id = product._id.toString();
      if (seen.has(id)) {
        return false;
      }
      seen.add(id);
      return true;
    });
  }

  private generateRecommendationReason(skinType: string, product: any): string {
    const reasonTemplates = {
      Acne: [
        `Perfect for acne-prone skin - ${product.productName} helps control oil and prevent breakouts`,
        `Recommended for acne treatment - Contains ingredients that target acne-causing bacteria`,
        `Ideal for oily and acne-prone skin - Helps reduce inflammation and clear pores`,
        `Great for acne management - ${product.brand} formulation designed for problematic skin`,
      ],
      Eczema: [
        `Gentle formula suitable for eczema-prone skin - ${product.productName} provides soothing relief`,
        `Recommended for sensitive skin - Helps calm inflammation and restore skin barrier`,
        `Perfect for eczema care - Fragrance-free and hypoallergenic formula`,
        `Ideal for sensitive skin conditions - ${product.brand} dermatologist-tested formula`,
      ],
      Normal: [
        `Perfect for maintaining healthy, normal skin - ${product.productName} provides balanced care`,
        `Ideal for normal skin maintenance - Helps preserve skin's natural balance`,
        `Great for daily skincare routine - Suitable for normal skin types`,
        `Recommended for balanced skin - ${product.brand} formula maintains skin health`,
      ],
      Psoriasis: [
        `Gentle care for psoriasis-prone skin - ${product.productName} helps reduce irritation`,
        `Recommended for sensitive skin conditions - Anti-inflammatory properties`,
        `Perfect for psoriasis management - Helps soothe and moisturize affected areas`,
        `Ideal for sensitive skin - ${product.brand} dermatologically tested for problem skin`,
      ],
    };

    const templates = reasonTemplates[skinType] || reasonTemplates['Normal'];
    const randomTemplate =
      templates[Math.floor(Math.random() * templates.length)];

    return randomTemplate;
  }

  private getFallbackRecommendations(skinType: string): any[] {
    return [
      {
        productId: new Types.ObjectId().toString(),
        reason: `Recommended cleanser for ${skinType} skin type - Gentle daily cleansing`,
      },
      {
        productId: new Types.ObjectId().toString(),
        reason: `Suitable moisturizer for ${skinType} skin - Provides optimal hydration`,
      },
      {
        productId: new Types.ObjectId().toString(),
        reason: `Treatment serum for ${skinType} skin concerns - Targeted care`,
      },
    ];
  }

  async processAndSaveAnalysis(
    imageBuffer: Buffer,
    userId: string,
    imageUrl: string,
  ): Promise<any> {
    // First validate if the user can perform analysis
    const eligibility = await this.validateUserAnalysisEligibility(userId);

    if (!eligibility.canAnalyze) {
      throw new ForbiddenException(eligibility.message);
    }

    const { skinType, confidence } = await this.runInference(imageBuffer);
    const recommendations = await this.generateRecommendations(skinType);

    const analysisData: CreateAnalyseDto = {
      userId,
      imageUrl,
      skinType,
      result: `Your skin type is ${skinType} with ${(confidence * 100).toFixed(1)}% confidence`,
      recommendedProducts: recommendations,
    };

    const savedAnalysis = await this.saveAnalysis(analysisData);

    // If user has subscription, record the AI token usage
    if (eligibility.subscriptionId) {
      await this.subscriptionService.useAiToken(eligibility.subscriptionId, 1);
    }

    // Get the analysis with recommendations
    return this.getAnalysisWithRecommendations(
      (savedAnalysis._id as Types.ObjectId).toString(),
    );
  }

  async getAnalysisWithRecommendations(analysisId: string): Promise<any> {
    const analysis = await this.analysisModel.findById(analysisId).exec();

    if (!analysis) {
      throw new NotFoundException(`Analysis with ID ${analysisId} not found`);
    }

    const recommendations = await this.recommendedProductsModel
      .find({ analysisId: new Types.ObjectId(analysisId) })
      .populate('productId', 'productName productImages brand price')
      .exec();

    return {
      ...analysis.toObject(),
      recommendedProducts: recommendations,
    };
  }

  async findByUserId(userId: string): Promise<any[]> {
    const analyses = await this.analysisModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ analysisDate: -1 })
      .exec();

    // Get recommendations for each analysis
    const analysesWithRecommendations = await Promise.all(
      analyses.map(async (analysis) => {
        const recommendations = await this.recommendedProductsModel
          .find({ analysisId: analysis._id })
          .populate('productId', 'productName productImages brand price')
          .exec();

        return {
          ...analysis.toObject(),
          recommendedProducts: recommendations,
        };
      }),
    );

    return analysesWithRecommendations;
  }

  async findOne(id: string): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid analysis ID format');
    }

    const analysis = await this.analysisModel.findById(id).exec();

    if (!analysis) {
      throw new NotFoundException(`Analysis with ID ${id} not found`);
    }

    return this.getAnalysisWithRecommendations(id);
  }

  async update(id: string, updateAnalyseDto: UpdateAnalyseDto): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid analysis ID format');
    }

    const analysis = await this.analysisModel.findById(id);

    if (!analysis) {
      throw new NotFoundException(`Analysis with ID ${id} not found`);
    }

    Object.assign(analysis, updateAnalyseDto);
    await analysis.save();

    return this.getAnalysisWithRecommendations(id);
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid analysis ID format');
    }

    const analysis = await this.analysisModel.findById(id);
    if (!analysis) {
      throw new NotFoundException(`Analysis with ID ${id} not found`);
    }

    // Delete related recommendations first
    await this.recommendedProductsModel.deleteMany({
      analysisId: new Types.ObjectId(id),
    });

    // Delete the analysis
    const result = await this.analysisModel.deleteOne({ _id: id });

    if (result.deletedCount === 0) {
      throw new NotFoundException(`Analysis with ID ${id} not found`);
    }

    return { deleted: true };
  }

  // New method to manage recommendations
  async getRecommendationsByAnalysis(
    analysisId: string,
  ): Promise<RecommendedProductsDocument[]> {
    return this.recommendedProductsModel
      .find({ analysisId: new Types.ObjectId(analysisId) })
      .populate('productId', 'productName productImages brand price')
      .exec();
  }

  async addRecommendation(
    analysisId: string,
    productId: string,
    reason: string,
  ): Promise<RecommendedProductsDocument> {
    const recommendation = new this.recommendedProductsModel({
      recommendationId: `rec-${Date.now()}`,
      analysisId: new Types.ObjectId(analysisId),
      productId: new Types.ObjectId(productId),
      reason,
    });

    return recommendation.save();
  }

  async removeRecommendation(
    recommendationId: string,
  ): Promise<{ deleted: boolean }> {
    const result = await this.recommendedProductsModel.deleteOne({
      recommendationId,
    });

    return { deleted: result.deletedCount > 0 };
  }
}
