import { Router } from 'express';
import mongoose from 'mongoose';
import { Product } from '../models/Product.js';

const router = Router();

router.get('/slugs', async (req, res) => {
  try {
    const list = await Product.find({}, { slug: 1 }).lean();
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 12));
    const category = req.query.category;
    const q = (req.query.q || '').trim();
    const sort = req.query.sort || '';

    const filter = {};
    if (category) filter.categoryId = new mongoose.Types.ObjectId(category);
    if (q) filter.$text = { $search: q };

    let query = Product.find(filter);
    if (sort === 'price_asc') query = query.sort({ price: 1 });
    else if (sort === 'price_desc') query = query.sort({ price: -1 });
    else if (sort === 'newest') query = query.sort({ createdAt: -1 });
    else if (sort === 'name') query = query.sort({ name: 1 });
    else query = query.sort({ order: 1, createdAt: -1 });

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      query.skip(skip).limit(limit).populate('categoryId').lean(),
      Product.countDocuments(filter),
    ]);

    res.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug })
      .populate('categoryId')
      .lean();
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
