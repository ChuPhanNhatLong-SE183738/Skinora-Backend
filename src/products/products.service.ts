import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product, ProductDocument } from './entities/product.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
  ) {}

  async create(createProductDto: CreateProductDto): Promise<ProductDocument> {
    try {
      const productData = {
        ...createProductDto,
        categories: createProductDto.categories?.map(
          (id) => new Types.ObjectId(id),
        ),
        promotionId: createProductDto.promotionId
          ? new Types.ObjectId(createProductDto.promotionId)
          : undefined,
        stock: createProductDto.stock || 0,
        isActive: createProductDto.isActive !== false,
      };

      const newProduct = new this.productModel(productData);
      return await newProduct.save();
    } catch (error) {
      throw new BadRequestException(
        `Failed to create product: ${error.message}`,
      );
    }
  }

  async findAll(filters?: any): Promise<any> {
    try {
      const query: any = { isActive: true };

      if (filters?.category) {
        if (Types.ObjectId.isValid(filters.category)) {
          query.categories = new Types.ObjectId(filters.category);
        }
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

      const products = await this.productModel
        .find(query)
        .populate('categories')
        .populate('promotionId')
        .sort({ createdAt: -1 })
        .exec();

      return {
        products,
        totalCount: products.length,
        page: 1,
        limit: products.length,
      };
    } catch (error) {
      console.error('Error in findAll:', error);
      return {
        products: [],
        totalCount: 0,
        page: 1,
        limit: 0,
      };
    }
  }

  async findOne(id: string): Promise<ProductDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid product ID format');
    }

    const product = await this.productModel
      .findById(id)
      .populate('categories')
      .populate('promotionId')
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

    const updateData = {
      ...updateProductDto,
      categories: updateProductDto.categories?.map(
        (id) => new Types.ObjectId(id),
      ),
      promotionId: updateProductDto.promotionId
        ? new Types.ObjectId(updateProductDto.promotionId)
        : undefined,
    };

    const product = await this.productModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .populate('categories')
      .populate('promotionId')
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

  // Add method to update product rating from external reviews
  async updateProductRating(
    productId: string,
    averageRating: number,
    totalReviews: number,
  ): Promise<void> {
    try {
      if (!Types.ObjectId.isValid(productId)) {
        throw new BadRequestException('Invalid product ID format');
      }

      await this.productModel.findByIdAndUpdate(productId, {
        averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
        totalReviews,
      });
    } catch (error) {
      console.error('Error updating product rating:', error);
    }
  }

  async searchProducts(searchTerm: string): Promise<ProductDocument[]> {
    const searchRegex = new RegExp(searchTerm, 'i');

    return this.productModel
      .find({
        $and: [
          { isActive: true },
          {
            $or: [
              { productName: { $regex: searchRegex } },
              { productDescription: { $regex: searchRegex } },
              { brand: { $regex: searchRegex } },
              { suitableFor: { $regex: searchRegex } },
            ],
          },
        ],
      })
      .populate('categories')
      .sort({ averageRating: -1 })
      .limit(20)
      .exec();
  }

  async getProductsByCategory(categoryId: string): Promise<ProductDocument[]> {
    if (!Types.ObjectId.isValid(categoryId)) {
      throw new BadRequestException('Invalid category ID format');
    }

    return this.productModel
      .find({
        categories: new Types.ObjectId(categoryId),
        isActive: true,
      })
      .populate('categories')
      .sort({ averageRating: -1 })
      .exec();
  }

  async getProductsBySkinType(skinType: string): Promise<ProductDocument[]> {
    try {
      const skinTypeQuery = new RegExp(skinType, 'i');
      return this.productModel
        .find({
          suitableFor: { $regex: skinTypeQuery },
          isActive: true,
          stock: { $gt: 0 },
        })
        .populate('categories')
        .sort({ averageRating: -1 })
        .limit(10)
        .exec();
    } catch (error) {
      console.error('Error in getProductsBySkinType:', error);
      return [];
    }
  }

  async getFeaturedProducts(): Promise<ProductDocument[]> {
    return this.productModel
      .find({
        isActive: true,
        averageRating: { $gte: 4.0 },
        totalReviews: { $gte: 5 },
      })
      .populate('categories')
      .sort({ averageRating: -1, totalReviews: -1 })
      .limit(10)
      .exec();
  }

  async updateStock(id: string, quantity: number): Promise<ProductDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid product ID format');
    }

    const product = await this.productModel.findById(id);
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    const newStock = product.stock + quantity;
    if (newStock < 0) {
      throw new BadRequestException('Stock cannot be negative');
    }

    product.stock = newStock;
    return await product.save();
  }
}
