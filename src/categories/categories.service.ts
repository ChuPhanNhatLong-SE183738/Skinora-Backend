import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category, CategoryDocument } from './entities/category.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
  ) {}

  async create(
    createCategoryDto: CreateCategoryDto,
  ): Promise<CategoryDocument> {
    try {
      // Check if category name or slug already exists
      const existingCategory = await this.categoryModel.findOne({
        $or: [
          { categoryName: createCategoryDto.categoryName },
          { slug: createCategoryDto.slug },
        ],
      });

      if (existingCategory) {
        throw new ConflictException('Category name or slug already exists');
      }

      const newCategory = new this.categoryModel(createCategoryDto);
      return await newCategory.save();
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to create category: ${error.message}`,
      );
    }
  }

  async findAll(): Promise<CategoryDocument[]> {
    return this.categoryModel.find({ isActive: true }).exec();
  }

  async findAllIncludeInactive(): Promise<CategoryDocument[]> {
    return this.categoryModel.find().exec();
  }

  async findOne(id: string): Promise<CategoryDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid category ID format');
    }

    const category = await this.categoryModel.findById(id).exec();
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    return category;
  }

  async findBySlug(slug: string): Promise<CategoryDocument> {
    const category = await this.categoryModel.findOne({ slug }).exec();
    if (!category) {
      throw new NotFoundException(`Category with slug ${slug} not found`);
    }
    return category;
  }

  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<CategoryDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid category ID format');
    }

    // Check if updating name or slug conflicts with existing categories
    if (updateCategoryDto.categoryName || updateCategoryDto.slug) {
      const conflictQuery: any[] = [];
      if (updateCategoryDto.categoryName) {
        conflictQuery.push({ categoryName: updateCategoryDto.categoryName });
      }
      if (updateCategoryDto.slug) {
        conflictQuery.push({ slug: updateCategoryDto.slug });
      }

      const existingCategory = await this.categoryModel.findOne({
        $and: [{ _id: { $ne: id } }, { $or: conflictQuery }],
      });

      if (existingCategory) {
        throw new ConflictException('Category name or slug already exists');
      }
    }

    const category = await this.categoryModel
      .findByIdAndUpdate(id, updateCategoryDto, { new: true })
      .exec();

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    return category;
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid category ID format');
    }

    const result = await this.categoryModel.deleteOne({ _id: id });
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    return { deleted: true };
  }

  async toggleActive(id: string): Promise<CategoryDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid category ID format');
    }

    const category = await this.categoryModel.findById(id).exec();
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    category.isActive = !category.isActive;
    return await category.save();
  }
}
