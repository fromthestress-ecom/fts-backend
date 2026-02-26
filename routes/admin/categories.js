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
    const { slug, name, description, image, order, navGroup, groupOrder } = req.body || {};
    if (!slug || !name) {
      return res.status(400).json({ message: 'slug and name are required' });
    }
    const category = await Category.create({
      slug: String(slug).trim(),
      name: String(name).trim(),
      description: description?.trim() || undefined,
      image: image?.trim() || undefined,
      order: Number(order) || 0,
      navGroup: navGroup != null ? String(navGroup).trim() : '',
      groupOrder: Number(groupOrder) ?? 0,
    });
    res.status(201).json(category);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Slug already exists' });
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { slug, name, description, image, order, navGroup, groupOrder } = req.body || {};
    const update = {};
    if (slug !== undefined) update.slug = String(slug).trim();
    if (name !== undefined) update.name = String(name).trim();
    if (description !== undefined) update.description = description?.trim() || '';
    if (image !== undefined) update.image = image?.trim() || '';
    if (order !== undefined) update.order = Number(order) || 0;
    if (navGroup !== undefined) update.navGroup = String(navGroup).trim();
    if (groupOrder !== undefined) update.groupOrder = Number(groupOrder) ?? 0;
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      update,
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
