import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

@Schema()
export class ProductImage {
  @Prop({ required: true })
  url: string;

  @Prop()
  alt: string;

  @Prop({ default: false })
  isPrimary: boolean;
}

export const ProductImageSchema = SchemaFactory.createForClass(ProductImage);

@Schema()
export class Ingredient {
  @Prop({ required: true })
  name: string;

  @Prop()
  percentage: number;

  @Prop()
  purpose: string;
}

export const IngredientSchema = SchemaFactory.createForClass(Ingredient);

@Schema()
export class Review {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ required: true })
  comment: string;

  @Prop({ type: Date, default: Date.now })
  reviewDate: Date;

  @Prop({ default: false })
  isVerified: boolean;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);

@Schema({ timestamps: true })
export class Product {
  @Prop({ required: true })
  productName: string;

  @Prop({ required: true })
  productDescription: string;

  @Prop({ type: [ProductImageSchema], default: [] })
  productImages: ProductImage[];

  @Prop({ type: [IngredientSchema], default: [] })
  ingredients: Ingredient[];

  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: 'Category' })
  categories: Types.ObjectId[];

  @Prop({ required: true })
  brand: string;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ required: true, min: 0, default: 0 })
  stock: number;

  @Prop({ required: true })
  suitableFor: string;

  @Prop({ type: [ReviewSchema], default: [] })
  reviews: Review[];

  @Prop({ type: Date })
  expiryDate: Date;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Promotions' })
  promotionId: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;

  // Virtual fields
  @Prop({ default: 0 })
  averageRating: number;

  @Prop({ default: 0 })
  totalReviews: number;

  @Prop({ default: true })
  isActive: boolean;
}

export type ProductDocument = Product & Document;
export const ProductSchema = SchemaFactory.createForClass(Product);

// Add indexes for better performance
ProductSchema.index({ productName: 'text', productDescription: 'text' });
ProductSchema.index({ categories: 1 });
ProductSchema.index({ brand: 1 });
ProductSchema.index({ suitableFor: 1 });
ProductSchema.index({ price: 1 });

// Pre-save middleware to calculate average rating
ProductSchema.pre('save', function (next) {
  if (this.reviews && this.reviews.length > 0) {
    const totalRating = this.reviews.reduce(
      (sum, review) => sum + review.rating,
      0,
    );
    this.averageRating = totalRating / this.reviews.length;
    this.totalReviews = this.reviews.length;
  } else {
    this.averageRating = 0;
    this.totalReviews = 0;
  }
  next();
});
