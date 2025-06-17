import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { AnalysisService } from './analysis.service';
import { AnalysisController } from './analysis.controller';
import { Analysis, AnalysisSchema } from './entities/analysis.entity';
import {
  RecommendedProducts,
  RecommendedProductsSchema,
} from './entities/recommended-products.entity';
import { ProductsModule } from '../products/products.module';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Analysis.name, schema: AnalysisSchema },
      { name: RecommendedProducts.name, schema: RecommendedProductsSchema },
    ]),
    MulterModule.register({
      dest: './uploads/skin-analysis',
    }),
    forwardRef(() => ProductsModule),
    forwardRef(() => SubscriptionModule),
  ],
  controllers: [AnalysisController],
  providers: [AnalysisService],
  exports: [AnalysisService],
})
export class AnalysisModule {}
