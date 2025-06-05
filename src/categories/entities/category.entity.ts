import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Category {
  @Prop({ required: true, unique: true })
  categoryName: string;

  @Prop({ required: true, unique: true })
  slug: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  imageUrl: string;

  @Prop({ default: true })
  isActive: boolean;
}

export type CategoryDocument = Category & Document;
export const CategorySchema = SchemaFactory.createForClass(Category);

// Add indexes for better performance
CategorySchema.index({ categoryName: 1 });
CategorySchema.index({ slug: 1 });
CategorySchema.index({ isActive: 1 });
