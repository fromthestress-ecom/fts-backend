import { Router } from "express";
import { requireAdmin } from "../../middleware/requireAdmin.js";
import { User } from "../../models/User.js";
import { Affiliate } from "../../models/Affiliate.js";

const router = Router();
router.use(requireAdmin);

// ─── List Users With Filters ───────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const rawSearch = (req.query.search || "").toString().trim();
    const role = (req.query.role || "").toString().trim();
    const affiliateFilter = (req.query.affiliate || "").toString().trim();

    const filter = {};

    if (role) {
      filter.role = role;
    }

    // Basic affiliate presence filters
    if (affiliateFilter === "has") {
      filter.affiliateId = { $ne: null };
    } else if (affiliateFilter === "none") {
      filter.affiliateId = { $in: [null], $exists: true };
    }

    if (rawSearch) {
      const regex = new RegExp(rawSearch, "i");
      filter.$or = [
        { fullName: { $regex: regex } },
        { email: { $regex: regex } },
        { phone: { $regex: regex } },
      ];
    }

    // Affiliate status-based filters (active / pending / suspended ...)
    if (
      affiliateFilter === "active" ||
      affiliateFilter === "pending" ||
      affiliateFilter === "suspended"
    ) {
      const affiliates = await Affiliate.find({ status: affiliateFilter })
        .select("_id")
        .lean();

      if (affiliates.length === 0) {
        return res.json({
          users: [],
          total: 0,
          page,
          totalPages: 0,
        });
      }

      const affiliateIds = affiliates.map((a) => a._id);
      filter.affiliateId = { $in: affiliateIds };
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("affiliateId")
        .lean(),
      User.countDocuments(filter),
    ]);

    res.json({
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;

