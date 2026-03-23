import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { User } from "../models/User.js";
import { ReferralConfig } from "../models/ReferralConfig.js";
import { ReferralUsage } from "../models/ReferralUsage.js";

const router = Router();

// ─── Validate a referral code ───────────────────────────────────────────────
router.get("/validate/:code", async (req, res) => {
  try {
    const { code } = req.params;
    if (!code) {
      return res
        .status(400)
        .json({ valid: false, message: "Code is required" });
    }

    // Find user with this referral code
    const referrer = await User.findOne({
      referralCode: code.toUpperCase(),
    }).select("_id fullName referralCode");

    if (!referrer) {
      return res.json({ valid: false, message: "Invalid referral code" });
    }

    // Get discount config
    const config = await ReferralConfig.getConfig();
    if (!config.isActive) {
      return res.json({
        valid: false,
        message: "Referral program is currently inactive",
      });
    }

    res.json({
      valid: true,
      referrerName: referrer.fullName,
      discountType: config.discountType,
      discountValue: config.discountValue,
      minOrderAmount: config.minOrderAmount,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Get current user's referral code ───────────────────────────────────────
router.get("/my-code", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "referralCode fullName",
    );
    const siteUrl = process.env.SITE_URL || "https://fromthestress.vn";

    // Count how many people used this code
    const usageCount = await ReferralUsage.countDocuments({
      referralCode: user.referralCode,
    });

    res.json({
      referralCode: user.referralCode,
      referralLink: `${siteUrl}?ref=${user.referralCode}`,
      totalReferred: usageCount,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
