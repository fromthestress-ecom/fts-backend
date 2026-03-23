import { Router } from "express";
import { User } from "../models/User.js";
import { hashPassword, verifyPassword, signToken } from "../utils/auth.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.post("/register", async (req, res) => {
  try {
    const { email, password, fullName, phone, referredByCode } = req.body || {};
    if (!email || !password || !fullName) {
      return res
        .status(400)
        .json({ message: "Email, password and fullName are required" });
    }
    if (String(password).length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters" });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: "Email already registered" });
    }

    // Resolve referredBy code
    let referredBy;
    if (referredByCode) {
      const referrer = await User.findOne({
        referralCode: referredByCode.toUpperCase(),
      });
      if (referrer) {
        referredBy = referrer._id;
      }
    }

    const passwordHash = hashPassword(password);
    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      fullName,
      phone: phone || undefined,
      referredBy: referredBy || undefined,
    });

    const payload = { sub: user._id.toString(), email: user.email };
    const accessToken = signToken(payload);
    res.json({
      accessToken,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        referralCode: user.referralCode,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const payload = { sub: user._id.toString(), email: user.email };
    const accessToken = signToken(payload);
    res.json({
      accessToken,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        referralCode: user.referralCode,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Get Current User ───────────────────────────────────────────────────────
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("-passwordHash")
      .populate("affiliateId");

    res.json({
      id: user._id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      referralCode: user.referralCode,
      affiliateId: user.affiliateId,
      createdAt: user.createdAt,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Forgot & Reset Password ────────────────────────────────────────────────
import crypto from "crypto";

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // return 200 anyway to prevent enumeration
      return res.json({
        message: "Nếu email tồn tại, hệ thống đã gửi link khôi phục mật khẩu.",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Log for local testing or simulate email
    const resetUrl = `${process.env.FRONTEND_URL || "https://fromthestress.vn"}/reset-password?token=${resetToken}`;
    console.log(`[Forgot Password] Reset URL for ${email}: ${resetUrl}`);

    res.json({
      message: "Đường dẫn khôi phục đã được gửi (kiểm tra console BE)",
      testUrl: resetUrl,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword) {
      return res
        .status(400)
        .json({ message: "Token and new password are required" });
    }
    if (String(newPassword).length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters" });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Token không hợp lệ hoặc đã hết hạn" });
    }

    user.passwordHash = hashPassword(newPassword);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: "Đổi mật khẩu thành công" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
