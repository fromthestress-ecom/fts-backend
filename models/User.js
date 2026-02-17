import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, required: true },
    phone: String,
    role: { type: String, default: 'customer' },
  },
  { timestamps: true }
);

export const User = mongoose.model('User', schema);
