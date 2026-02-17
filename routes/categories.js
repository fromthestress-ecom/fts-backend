import { Router } from 'express';
import { Category } from '../models/Category.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const list = await Category.find().sort({ order: 1 }).lean();
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    const category = await Category.findOne({ slug: req.params.slug }).lean();
    if (!category) return res.status(404).json({ message: 'Category not found' });
    res.json(category);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
