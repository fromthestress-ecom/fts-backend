import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 1 },
    size: String,
    color: String,
  },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    userId: String,
    guestId: { type: String, required: true, unique: true },
    items: { type: [cartItemSchema], default: [] },
  },
  { timestamps: true }
);

schema.index({ userId: 1 });

export const Cart = mongoose.model('Cart', schema);
