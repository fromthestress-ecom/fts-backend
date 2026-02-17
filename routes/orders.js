import { Router } from 'express';
import { Order } from '../models/Order.js';

const router = Router();

async function getNextOrderNumber() {
  const last = await Order.findOne().sort({ createdAt: -1 }).select('orderNumber').lean();
  const num = last?.orderNumber ? parseInt(last.orderNumber.replace(/\D/g, ''), 10) + 1 : 1;
  return `SW${String(num).padStart(6, '0')}`;
}

router.post('/', async (req, res) => {
  try {
    const { email, items, shippingAddress, note } = req.body || {};
    if (!email || !Array.isArray(items) || !items.length || !shippingAddress) {
      return res.status(400).json({ message: 'email, items and shippingAddress are required' });
    }
    const { fullName, phone, address, city, district, ward } = shippingAddress;
    if (!fullName || !phone || !address) {
      return res.status(400).json({ message: 'shippingAddress must have fullName, phone, address' });
    }

    const subtotal = items.reduce((sum, i) => sum + (i.price || 0) * (i.quantity || 0), 0);
    const shippingFee = subtotal >= 500000 ? 0 : 30000;
    const orderNumber = await getNextOrderNumber();

    const order = await Order.create({
      orderNumber,
      email,
      items,
      shippingAddress: { fullName, phone, address, city, district, ward },
      subtotal,
      shippingFee,
      note: note || undefined,
    });
    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/my', async (req, res) => {
  try {
    const email = req.query.email || '';
    const list = await Order.find({ email }).sort({ createdAt: -1 }).lean();
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:orderNumber', async (req, res) => {
  try {
    const order = await Order.findOne({ orderNumber: req.params.orderNumber }).lean();
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
