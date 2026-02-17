import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    size: String,
    color: String,
    image: String,
  },
  { _id: false }
);

const shippingAddressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    city: String,
    district: String,
    ward: String,
  },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true },
    userId: String,
    email: { type: String, required: true },
    items: { type: [orderItemSchema], required: true },
    shippingAddress: { type: shippingAddressSchema, required: true },
    subtotal: { type: Number, default: 0 },
    shippingFee: { type: Number, default: 0 },
    status: { type: String, default: 'pending' },
    note: String,
  },
  { timestamps: true }
);

schema.index({ orderNumber: 1 });
schema.index({ userId: 1 });
schema.index({ email: 1 });

export const Order = mongoose.model('Order', schema);
