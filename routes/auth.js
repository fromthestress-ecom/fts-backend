import crypto from "crypto";
import { Router } from "express";
import { User } from "../models/User.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { hashPassword, signToken, verifyPassword } from "../utils/auth.js";
import { sendMail } from "../utils/mailer.js";

const router = Router();

function buildResetPasswordEmailHtml({ fullName, resetUrl }) {
  return `
    <div style="font-family:Arial,sans-serif;color:#111;line-height:1.6">
      <h2 style="margin:0 0 16px">Khôi phục mật khẩu</h2>
      <p>Xin chao ${fullName || "ban"},</p>
      <p>Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản FROM THE STRESS của bạn.</p>
      <p>
        <a
          href="${resetUrl}"
          style="display:inline-block;padding:12px 20px;background:#111;color:#fff;text-decoration:none;border-radius:6px"
        >
          Khôi phục mật khẩu
        </a>
      </p>
      <p>Hoặc mở liên kết này trong trình duyệt:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>Liên kết có hiệu lực trong 1 giờ. Nếu bạn không yêu cầu đặt lại mật khẩu, hay bỏ qua email này.</p>
    </div>
  `;
}

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

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: "Email chua ton tai" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000;
    await user.save();

    const requestOrigin = req.get("origin");
    const frontendBaseUrl =
      requestOrigin || process.env.FRONTEND_URL || "https://fromthestress.vn";
    const resetUrl = `${frontendBaseUrl.replace(/\/$/, "")}/reset-password?token=${resetToken}`;

    await sendMail({
      to: user.email,
      subject: "Khoi phuc mat khau FROM THE STRESS",
      html: buildResetPasswordEmailHtml({
        fullName: user.fullName,
        resetUrl,
      }),
    });

    res.json({
      message: "Da gui email khoi phuc mat khau",
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

    const resetTokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      resetPasswordToken: resetTokenHash,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Token khong hop le hoac da het han" });
    }

    user.passwordHash = hashPassword(newPassword);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: "Doi mat khau thanh cong" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
