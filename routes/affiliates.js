import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireAffiliate } from "../middleware/requireAffiliate.js";
import { Affiliate } from "../models/Affiliate.js";
import { AffiliateCommission } from "../models/AffiliateCommission.js";
import { WalletTransaction } from "../models/WalletTransaction.js";
import { User } from "../models/User.js";
import { Product } from "../models/Product.js";

const router = Router();

const MIN_WITHDRAWAL = 100000; // 100,000 VND minimum

// ─── Register as Affiliate ──────────────────────────────────────────────────
router.post("/register", requireAuth, async (req, res) => {
  try {
    const existing = await Affiliate.findOne({ userId: req.user._id });
    if (existing) {
      return res
        .status(409)
        .json({
          message: "Affiliate application already exists",
          affiliate: existing,
        });
    }

    const affiliate = await Affiliate.create({ userId: req.user._id });

    // Link affiliate to user
    await User.findByIdAndUpdate(req.user._id, { affiliateId: affiliate._id });

    res.status(201).json(affiliate);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Dashboard Overview ─────────────────────────────────────────────────────
router.get("/dashboard", requireAffiliate, async (req, res) => {
  try {
    const affiliate = req.affiliate;
    const commissions = await AffiliateCommission.find({
      affiliateId: affiliate._id,
    });

    const totalOrders = commissions.length;
    const approvedCommissions = commissions.filter(
      (c) => c.status === "approved" || c.status === "paid",
    );
    const conversionRate =
      affiliate.totalReferrals > 0
        ? ((totalOrders / affiliate.totalReferrals) * 100).toFixed(1)
        : 0;

    res.json({
      totalEarned: affiliate.totalEarned,
      pendingBalance: affiliate.pendingBalance,
      walletBalance: affiliate.walletBalance,
      totalReferrals: affiliate.totalReferrals,
      totalOrders,
      conversionRate,
      commissionRate: affiliate.commissionRate,
      status: affiliate.status,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── My Affiliate Status (for any auth user) ────────────────────────────────
router.get("/status", requireAuth, async (req, res) => {
  try {
    const affiliate = await Affiliate.findOne({ userId: req.user._id });
    if (!affiliate) {
      return res.json({ isAffiliate: false, status: null });
    }
    res.json({
      isAffiliate: true,
      status: affiliate.status,
      affiliateId: affiliate._id,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── List Commissions ───────────────────────────────────────────────────────
router.get("/commissions", requireAffiliate, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      AffiliateCommission.find({ affiliateId: req.affiliate._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AffiliateCommission.countDocuments({ affiliateId: req.affiliate._id }),
    ]);

    res.json({
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Request Withdrawal ─────────────────────────────────────────────────────
router.post("/withdraw", requireAffiliate, async (req, res) => {
  try {
    const { amount } = req.body || {};
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Valid amount is required" });
    }
    if (amount < MIN_WITHDRAWAL) {
      return res.status(400).json({
        message: `Minimum withdrawal is ${MIN_WITHDRAWAL.toLocaleString("vi-VN")}đ`,
      });
    }
    if (amount > req.affiliate.walletBalance) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    // Deduct from wallet, create pending transaction
    await Affiliate.findByIdAndUpdate(req.affiliate._id, {
      $inc: { walletBalance: -amount },
    });

    const transaction = await WalletTransaction.create({
      affiliateId: req.affiliate._id,
      amount,
      type: "withdrawal",
      status: "pending",
    });

    res.status(201).json(transaction);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Withdrawal History ─────────────────────────────────────────────────────
router.get("/withdrawals", requireAffiliate, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      WalletTransaction.find({
        affiliateId: req.affiliate._id,
        type: "withdrawal",
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      WalletTransaction.countDocuments({
        affiliateId: req.affiliate._id,
        type: "withdrawal",
      }),
    ]);

    res.json({ items, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Products with Affiliate Links ──────────────────────────────────────────
router.get("/products", requireAffiliate, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      Product.find({ inStock: true })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments({ inStock: true }),
    ]);

    // Attach affiliate link to each product
    const siteUrl = process.env.SITE_URL || "https://fromthestress.vn";
    const items = products.map((p) => ({
      ...p,
      affiliateLink: `${siteUrl}/san-pham/${p.slug}?ref=${req.affiliate._id}`,
    }));

    res.json({ items, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
