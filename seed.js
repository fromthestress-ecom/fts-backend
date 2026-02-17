import 'dotenv/config';
import mongoose from 'mongoose';
import { Category } from './models/Category.js';
import { Product } from './models/Product.js';

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/streetwear';

async function run() {
  await mongoose.connect(uri);

  await Category.deleteMany({});
  await Product.deleteMany({});

  const categories = await Category.insertMany([
    { slug: 'ao-hoodie', name: 'Áo Hoodie', description: 'Hoodie streetwear', order: 0 },
    { slug: 'ao-thun', name: 'Áo thun', description: 'Tee basic & graphic', order: 1 },
    { slug: 'quan', name: 'Quần', description: 'Jogger, cargo', order: 2 },
  ]);
  const [hoodie, tee, quan] = categories;

  await Product.insertMany([
    {
      slug: 'hoodie-black-basic',
      name: 'Hoodie Black Basic',
      description: 'Hoodie trơn form rộng, chất nỉ mềm.',
      price: 450000,
      compareAtPrice: 550000,
      images: ['https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600'],
      categoryId: hoodie._id,
      inStock: true,
      stockQuantity: 50,
      sizes: ['S', 'M', 'L', 'XL'],
      colors: ['Đen', 'Xám'],
      order: 0,
    },
    {
      slug: 'tee-white-oversize',
      name: 'Tee White Oversize',
      description: 'Áo thun oversize cotton 100%.',
      price: 280000,
      images: ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600'],
      categoryId: tee._id,
      inStock: true,
      stockQuantity: 100,
      sizes: ['S', 'M', 'L', 'XL'],
      colors: ['Trắng', 'Đen'],
      order: 0,
    },
    {
      slug: 'quan-jogger-ni',
      name: 'Quần Jogger Nỉ',
      description: 'Quần jogger chất nỉ, bo gấu.',
      price: 380000,
      images: ['https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=600'],
      categoryId: quan._id,
      inStock: true,
      stockQuantity: 40,
      sizes: ['S', 'M', 'L', 'XL'],
      colors: ['Đen', 'Xám đen'],
      order: 0,
    },
  ]);

  console.log('Seed done.');
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
