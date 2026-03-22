import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: String,
    price: { type: Number, required: true },
    compareAtPrice: { type: Number, default: 0 },
    images: { type: [String], default: [] },
    sizeChart: String,
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductTemplate",
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
    },
    inStock: { type: Boolean, default: true },
    preOrder: { type: Boolean, default: false },
    stockQuantity: { type: Number, default: 0 },
    sizes: { type: [String], default: [] },
    colors: { type: [String], default: [] },
    order: { type: Number, default: 0 },
    isSoldOut: { type: Boolean, default: false },
  },
  { timestamps: true },
);

schema.index({ categoryId: 1 });
schema.index({ name: "text", description: "text" });
// Added for performance optimization
schema.index({ preOrder: 1 });
schema.index({ order: 1, createdAt: -1 });
schema.index({ eventId: 1 });

export const Product = mongoose.model("Product", schema);
