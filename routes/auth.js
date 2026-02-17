import { Router } from 'express';
import { User } from '../models/User.js';
import { hashPassword, verifyPassword, signToken } from '../utils/auth.js';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { email, password, fullName, phone } = req.body || {};
    if (!email || !password || !fullName) {
      return res.status(400).json({ message: 'Email, password and fullName are required' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const passwordHash = hashPassword(password);
    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      fullName,
      phone: phone || undefined,
    });

    const payload = { sub: user._id.toString(), email: user.email };
    const accessToken = signToken(payload);
    res.json({
      accessToken,
      user: { id: user._id, email: user.email, fullName: user.fullName },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const payload = { sub: user._id.toString(), email: user.email };
    const accessToken = signToken(payload);
    res.json({
      accessToken,
      user: { id: user._id, email: user.email, fullName: user.fullName },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
