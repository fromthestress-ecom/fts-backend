import { Router } from 'express';
import mongoose from 'mongoose';
import { Cart } from '../models/Cart.js';

const router = Router();

function getGuestId(header) {
  return header || `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

router.get('/', async (req, res) => {
  try {
    const guestId = getGuestId(req.headers['x-guest-id']);
    let cart = await Cart.findOne({ guestId });
    if (!cart) cart = await Cart.create({ guestId, items: [] });
    const populated = await Cart.findById(cart._id).populate('items.productId');
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/items', async (req, res) => {
  try {
    const guestId = getGuestId(req.headers['x-guest-id']);
    const { productId, quantity = 1, size, color } = req.body || {};
    if (!productId) return res.status(400).json({ message: 'productId is required' });

    let cart = await Cart.findOne({ guestId });
    if (!cart) cart = await Cart.create({ guestId, items: [] });

    const pid = new mongoose.Types.ObjectId(productId);
    const items = [...cart.items];
    const existing = items.find(
      (i) => i.productId.toString() === pid.toString() && i.size === (size || '') && i.color === (color || '')
    );
    if (existing) existing.quantity += Number(quantity) || 1;
    else items.push({ productId: pid, quantity: Number(quantity) || 1, size, color });

    await Cart.findByIdAndUpdate(cart._id, { items });
    const updated = await Cart.findById(cart._id).populate('items.productId');
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/items/:productId', async (req, res) => {
  try {
    const guestId = getGuestId(req.headers['x-guest-id']);
    const { productId } = req.params;
    const quantity = Number(req.body?.quantity ?? 0);

    let cart = await Cart.findOne({ guestId });
    if (!cart) cart = await Cart.create({ guestId, items: [] });

    const pid = new mongoose.Types.ObjectId(productId);
    let items = cart.items.filter((i) => i.productId.toString() !== pid.toString());
    if (quantity > 0) {
      const existing = cart.items.find((i) => i.productId.toString() === pid.toString());
      if (existing) items.push({ ...existing.toObject(), quantity });
    }

    await Cart.findByIdAndUpdate(cart._id, { items });
    const updated = await Cart.findById(cart._id).populate('items.productId');
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/items/:productId', async (req, res) => {
  try {
    const guestId = getGuestId(req.headers['x-guest-id']);
    const { productId } = req.params;

    const cart = await Cart.findOne({ guestId });
    if (!cart) return res.json({ _id: null, items: [] });

    const pid = new mongoose.Types.ObjectId(productId);
    const items = cart.items.filter((i) => i.productId.toString() !== pid.toString());
    await Cart.findByIdAndUpdate(cart._id, { items });
    const updated = await Cart.findById(cart._id).populate('items.productId');
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
