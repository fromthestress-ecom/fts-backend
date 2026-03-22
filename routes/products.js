import { Router } from "express";
import mongoose from "mongoose";
import { Product } from "../models/Product.js";
import { Category } from "../models/Category.js";
import { Order } from "../models/Order.js";
import { applyEventPricing } from "../utils/eventPrice.js";

const router = Router();

router.get("/slugs", async (req, res) => {
  try {
    const list = await Product.find({}, { slug: 1 }).lean();
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit, 10) || 12),
    );
    const category = req.query.category;
    const eventFilter = req.query.event;
    const navGroup = (req.query.navGroup || "").trim();
    const exclude = (req.query.exclude || "").trim();
    const q = (req.query.q || "").trim();
    const sort = req.query.sort || "";
    const preOrder = req.query.preOrder;

    const filter = {};
    if (category) filter.categoryId = new mongoose.Types.ObjectId(category);
    if (eventFilter) filter.eventId = new mongoose.Types.ObjectId(eventFilter);
    if (navGroup) {
      const categoryIds = await Category.find({ navGroup })
        .select("_id")
        .lean();
      const ids = categoryIds.map((c) => c._id);
      if (ids.length > 0) filter.categoryId = { $in: ids };
      else filter.categoryId = null;
    }
    if (exclude) filter.slug = { $ne: exclude };
    if (q) filter.$text = { $search: q };
    if (preOrder === "true") filter.preOrder = true;
    else if (preOrder === "false") filter.preOrder = false;

    let query = Product.find(filter);
    if (sort === "price_asc") query = query.sort({ price: 1 });
    else if (sort === "price_desc") query = query.sort({ price: -1 });
    else if (sort === "newest") query = query.sort({ createdAt: -1 });
    else if (sort === "name") query = query.sort({ name: 1 });
    else query = query.sort({ order: 1, createdAt: -1 });

    const skip = (page - 1) * limit;
    const [rawItems, total] = await Promise.all([
      query
        .skip(skip)
        .limit(limit)
        .populate("categoryId")
        .populate("templateId")
        .populate("eventId")
        .lean(),
      Product.countDocuments(filter),
    ]);

    const items = applyEventPricing(rawItems);

    res.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/best-selling", async (req, res) => {
  try {
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 8));

    // Aggregate orders that are delivered
    const bestSellingIds = await Order.aggregate([
      { $match: { status: "delivered" } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          totalSold: { $sum: "$items.quantity" },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: limit },
    ]);

    if (bestSellingIds.length === 0) {
      return res.json([]);
    }

    // Extract product IDs
    const productIds = bestSellingIds.map((b) => b._id);

    // Fetch the actual products
    const products = await Product.find({ _id: { $in: productIds } })
      .populate("categoryId")
      .populate("templateId")
      .populate("eventId")
      .lean();

    // Map the fetched products back to the sorted order from the aggregation
    const sortedProducts = bestSellingIds
      .map((b) => products.find((p) => p._id.toString() === b._id.toString()))
      .filter((p) => p != null);

    res.json(applyEventPricing(sortedProducts));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:slug", async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug })
      .populate("categoryId")
      .populate("templateId")
      .populate("eventId")
      .lean();
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(applyEventPricing(product));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
