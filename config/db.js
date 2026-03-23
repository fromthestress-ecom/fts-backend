import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/streetwear';

export async function connectDb() {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, family: 4 });
}
