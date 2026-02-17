import { Router } from 'express';
import { requireAdmin } from '../../middleware/requireAdmin.js';

const router = Router();

router.post('/verify', (req, res) => {
  const key = req.headers['x-admin-key'];
  const valid = process.env.ADMIN_API_KEY && key === process.env.ADMIN_API_KEY;
  if (!valid) return res.status(401).json({ ok: false, message: 'Invalid admin key' });
  res.json({ ok: true });
});

export default router;
