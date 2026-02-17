import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: String,
    price: { type: Number, required: true },
    compareAtPrice: { type: Number, default: 0 },
    images: { type: [String], default: [] },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    inStock: { type: Boolean, default: true },
    stockQuantity: { type: Number, default: 0 },
    sizes: { type: [String], default: [] },
    colors: { type: [String], default: [] },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

schema.index({ categoryId: 1 });
schema.index({ name: 'text', description: 'text' });

export const Product = mongoose.model('Product', schema);
