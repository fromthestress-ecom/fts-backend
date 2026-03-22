import { Router } from "express";
import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";
import { User } from "../models/User.js";
import { Affiliate } from "../models/Affiliate.js";
import { AffiliateCommission } from "../models/AffiliateCommission.js";
import { ReferralUsage } from "../models/ReferralUsage.js";
import { ReferralConfig } from "../models/ReferralConfig.js";
import { WalletTransaction } from "../models/WalletTransaction.js";
import { computeEventPrice } from "../utils/eventPrice.js";

const router = Router();

async function getNextOrderNumber() {
  const last = await Order.findOne()
    .sort({ createdAt: -1 })
    .select("orderNumber")
    .lean();
  const num = last?.orderNumber
    ? parseInt(last.orderNumber.replace(/\D/g, ""), 10) + 1
    : 1;
  return `SW${String(num).padStart(6, "0")}`;
}

router.post("/", async (req, res) => {
  try {
    const {
      email,
      items,
      shippingAddress,
      note,
      referralCode,
      affiliateRef,
      userId,
    } = req.body || {};
    if (!email || !Array.isArray(items) || !items.length || !shippingAddress) {
      return res
        .status(400)
        .json({ message: "email, items and shippingAddress are required" });
    }
    const { fullName, phone, address, city, district, ward } = shippingAddress;
    if (!fullName || !phone || !address) {
      return res.status(400).json({
        message: "shippingAddress must have fullName, phone, address",
      });
    }

    // Re-validate prices with active events
    const productIds = items.map((i) => i.productId).filter(Boolean);
    const dbProducts = await Product.find({ _id: { $in: productIds } })
      .populate("eventId")
      .lean();

    const validatedItems = items.map((item) => {
      const dbProd = dbProducts.find(
        (p) => p._id.toString() === String(item.productId),
      );
      if (!dbProd) return item;
      const withEvent = computeEventPrice(dbProd);
      return { ...item, price: withEvent.finalPrice };
    });

    let subtotal = validatedItems.reduce(
      (sum, i) => sum + (i.price || 0) * (i.quantity || 0),
      0,
    );
    let discount = 0;

    // ── Referral Code Discount ──────────────────────────────────────────
    if (referralCode && userId) {
      const config = await ReferralConfig.getConfig();
      if (!config.isActive) {
        return res
          .status(400)
          .json({ message: "Chương trình giới thiệu hiện đang tạm ngưng" });
      }

      const referrer = await User.findOne({
        referralCode: referralCode.toUpperCase(),
      });

      if (!referrer) {
        return res.status(400).json({ message: "Mã giới thiệu không tồn tại" });
      }

      // Prevent self-referral
      if (referrer._id.toString() === userId) {
        return res
          .status(400)
          .json({ message: "Bạn không thể tự giới thiệu chính mình" });
      }

      // Check if this user already used a referral code
      const alreadyUsed = await ReferralUsage.findOne({
        usedByUserId: userId,
      });

      if (alreadyUsed) {
        return res
          .status(400)
          .json({ message: "Bạn đã từng sử dụng mã giới thiệu trước đây rồi" });
      }

      if (subtotal < config.minOrderAmount) {
        return res
          .status(400)
          .json({
            message: `Đơn hàng tối thiểu để áp dụng mã là ${config.minOrderAmount.toLocaleString("vi-VN")}đ`,
          });
      }

      if (config.discountType === "percent") {
        discount = Math.round(subtotal * (config.discountValue / 100));
      } else {
        discount = config.discountValue;
      }
      discount = Math.min(discount, subtotal); // never exceed subtotal
    }

    // subtotal = subtotal - discount; // Do NOT mutate subtotal, calculate total instead
    const totalAmount = subtotal - discount;
    const shippingFee = totalAmount >= 500000 ? 0 : 30000;
    const orderNumber = await getNextOrderNumber();

    const order = await Order.create({
      orderNumber,
      userId: userId || undefined,
      email,
      items: validatedItems,
      shippingAddress: { fullName, phone, address, city, district, ward },
      subtotal,
      shippingFee,
      discount,
      referralCode:
        discount > 0 && referralCode ? referralCode.toUpperCase() : undefined,
      note: note || undefined,
    });

    // ── Record Referral Usage ───────────────────────────────────────────
    if (discount > 0 && referralCode && userId) {
      const referrer = await User.findOne({
        referralCode: referralCode.toUpperCase(),
      });
      if (referrer) {
        await ReferralUsage.create({
          referralCode: referralCode.toUpperCase(),
          referrerUserId: referrer._id,
          usedByUserId: userId,
          discountAmount: discount,
          discountType: (await ReferralConfig.getConfig()).discountType,
          orderId: order._id,
        });
      }
    }

    // ── Affiliate Commission Tracking ───────────────────────────────────
    if (affiliateRef) {
      const affiliate = await Affiliate.findOne({
        _id: affiliateRef,
        status: "active",
      });
      if (affiliate) {
        // Prevent self-commission: affiliate user cannot earn from own orders
        if (!userId || affiliate.userId.toString() !== userId) {
          const commissionAmount = Math.round(
            (subtotal - discount) * (affiliate.commissionRate / 100),
          );

          const commission = await AffiliateCommission.create({
            affiliateId: affiliate._id,
            orderId: order._id,
            orderNumber,
            amount: commissionAmount,
            rate: affiliate.commissionRate,
            status: "pending",
          });

          // Update affiliate pending balance and stats
          await Affiliate.findByIdAndUpdate(affiliate._id, {
            $inc: {
              pendingBalance: commissionAmount,
              totalEarned: commissionAmount,
              totalOrders: 1,
              totalReferrals: 1,
            },
          });

          // Record wallet transaction
          await WalletTransaction.create({
            affiliateId: affiliate._id,
            amount: commissionAmount,
            type: "commission",
            status: "pending",
            note: `Commission for order ${orderNumber}`,
          });
        }
      }
    }

    res.status(201).json({ ...order.toObject(), discount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/my", async (req, res) => {
  try {
    const email = req.query.email || "";
    const list = await Order.find({ email }).sort({ createdAt: -1 }).lean();
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:orderNumber", async (req, res) => {
  try {
    const order = await Order.findOne({
      orderNumber: req.params.orderNumber,
    }).lean();
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
