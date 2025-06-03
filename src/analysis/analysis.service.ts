import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as ort from 'onnxruntime-node';
import * as sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import { Analysis, AnalysisDocument } from './entities/analysis.entity';
import { CreateAnalyseDto } from './dto/create-analyse.dto';
import { UpdateAnalyseDto } from './dto/update-analyse.dto';

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
  ) {
    this.modelPath = path.join(
      process.cwd(),
      'models',
      'resnet50_skin_final_1.onnx',
    );
    this.labels = ['oily', 'dry', 'normal'];
    this.initModel();
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
        recommendedProducts:
          createAnalyseDto.recommendedProducts?.map((rec) => ({
            ...rec,
            productId: new Types.ObjectId(rec.productId),
          })) || [],
      });

      return await newAnalysis.save();
    } catch (error) {
      this.logger.error(`Error saving analysis: ${error.message}`);
      throw new BadRequestException(
        `Failed to save analysis: ${error.message}`,
      );
    }
  }

  async generateRecommendations(skinType: string): Promise<any[]> {
    try {
      // Mock recommendations if ProductsService is not available
      return [
        {
          recommendationId: `rec-1-${Date.now()}`,
          productId: new Types.ObjectId().toString(),
          reason: `Suitable for ${skinType} skin type - Gentle cleanser`,
        },
        {
          recommendationId: `rec-2-${Date.now()}`,
          productId: new Types.ObjectId().toString(),
          reason: `Suitable for ${skinType} skin type - Moisturizer`,
        },
        {
          recommendationId: `rec-3-${Date.now()}`,
          productId: new Types.ObjectId().toString(),
          reason: `Suitable for ${skinType} skin type - Serum`,
        },
      ];
    } catch (error) {
      this.logger.error(`Error generating recommendations: ${error.message}`);
      return [];
    }
  }

  async processAndSaveAnalysis(
    imageBuffer: Buffer,
    userId: string,
    imageUrl: string,
  ): Promise<AnalysisDocument> {
    const { skinType, confidence } = await this.runInference(imageBuffer);
    const recommendations = await this.generateRecommendations(skinType);

    const analysisData: CreateAnalyseDto = {
      userId,
      imageUrl,
      skinType,
      result: `Your skin type is ${skinType} with ${(confidence * 100).toFixed(1)}% confidence`,
      recommendedProducts: recommendations,
    };

    return this.saveAnalysis(analysisData);
  }

  async findByUserId(userId: string): Promise<AnalysisDocument[]> {
    return this.analysisModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ analysisDate: -1 })
      .exec();
  }

  async findOne(id: string): Promise<AnalysisDocument> {
    const analysis = await this.analysisModel.findById(id).exec();

    if (!analysis) {
      throw new NotFoundException(`Analysis with ID ${id} not found`);
    }

    return analysis;
  }

  async update(
    id: string,
    updateAnalyseDto: UpdateAnalyseDto,
  ): Promise<AnalysisDocument> {
    const analysis = await this.analysisModel.findById(id);

    if (!analysis) {
      throw new NotFoundException(`Analysis with ID ${id} not found`);
    }

    Object.assign(analysis, updateAnalyseDto);

    if (updateAnalyseDto.recommendedProducts) {
      analysis.recommendedProducts = updateAnalyseDto.recommendedProducts.map(
        (rec) => ({
          ...rec,
          productId: new Types.ObjectId(rec.productId),
        }),
      );
    }

    return analysis.save();
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const result = await this.analysisModel.deleteOne({ _id: id });

    if (result.deletedCount === 0) {
      throw new NotFoundException(`Analysis with ID ${id} not found`);
    }

    return { deleted: true };
  }
}
