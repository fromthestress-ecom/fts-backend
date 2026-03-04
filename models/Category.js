import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: String,
    image: String,
    order: { type: Number, default: 0 },
    navGroup: { type: String, default: "" },
    groupOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Added for performance optimization
schema.index({ navGroup: 1 });
schema.index({ order: 1, groupOrder: 1 });

export const Category = mongoose.model("Category", schema);
