import { Router } from 'express';
import { Category } from '../../models/Category.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';

const router = Router();
router.use(requireAdmin);

router.get('/', async (req, res) => {
  try {
    const list = await Category.find().sort({ order: 1 }).lean();
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { slug, name, description, image, order } = req.body || {};
    if (!slug || !name) {
      return res.status(400).json({ message: 'slug and name are required' });
    }
    const category = await Category.create({
      slug: String(slug).trim(),
      name: String(name).trim(),
      description: description?.trim() || undefined,
      image: image?.trim() || undefined,
      order: Number(order) || 0,
    });
    res.status(201).json(category);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Slug already exists' });
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { slug, name, description, image, order } = req.body || {};
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      {
        ...(slug !== undefined && { slug: String(slug).trim() }),
        ...(name !== undefined && { name: String(name).trim() }),
        ...(description !== undefined && { description: description?.trim() || '' }),
        ...(image !== undefined && { image: image?.trim() || '' }),
        ...(order !== undefined && { order: Number(order) || 0 }),
      },
      { new: true, runValidators: true }
    ).lean();
    if (!category) return res.status(404).json({ message: 'Category not found' });
    res.json(category);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Slug already exists' });
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
