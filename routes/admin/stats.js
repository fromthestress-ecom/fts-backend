import express from "express";
import { Order } from "../../models/Order.js";

const router = express.Router();

// GET /admin/stats/best-sellers
router.get("/best-sellers", async (req, res, next) => {
  try {
    const { startDate, endDate, limit = 10 } = req.query;

    // Base match for completed orders
    const matchStage = { status: "delivered" };

    // Apply date range if provided
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    const bestSellers = await Order.aggregate([
      { $match: matchStage },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          name: { $first: "$items.name" },
          totalQuantity: { $sum: "$items.quantity" },
          revenue: {
            $sum: { $multiply: ["$items.price", "$items.quantity"] },
          },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: Number(limit) },
    ]);

    res.json(bestSellers);
  } catch (err) {
    next(err);
  }
});

// GET /admin/stats/top-buyers
router.get("/top-buyers", async (req, res, next) => {
  try {
    const { startDate, endDate, limit = 10 } = req.query;

    // Base match for completed orders
    const matchStage = { status: "delivered" };

    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    const topBuyers = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$email",
          fullName: { $first: "$shippingAddress.fullName" },
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: "$subtotal" }, // Or actual amount paid
        },
      },
      { $sort: { totalSpent: -1 } },
      { $limit: Number(limit) },
    ]);

    res.json(topBuyers);
  } catch (err) {
    next(err);
  }
});

export default router;
