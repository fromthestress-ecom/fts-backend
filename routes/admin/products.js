import { Router } from "express";
import mongoose from "mongoose";
import { Product } from "../../models/Product.js";
import { requireAdmin } from "../../middleware/requireAdmin.js";

const router = Router();
router.use(requireAdmin);

router.get("/", async (req, res) => {
  try {
    const list = await Product.find()
      .populate("categoryId")
      .populate("templateId")
      .sort({ order: 1, createdAt: -1 })
      .lean();
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ message: "Invalid ID" });
    const product = await Product.findById(req.params.id)
      .populate("categoryId")
      .populate("templateId")
      .lean();
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const body = req.body || {};
    const {
      slug,
      name,
      description,
      price,
      compareAtPrice,
      images,
      categoryId,
      inStock,
      stockQuantity,
      sizes,
      colors,
      templateId,
      order,
      preOrder,
      isSoldOut,
    } = body;
    if (!slug || !name || price == null) {
      return res
        .status(400)
        .json({ message: "slug, name and price are required" });
    }
    const product = await Product.create({
      slug: String(slug).trim(),
      name: String(name).trim(),
      description: description?.trim() || undefined,
      price: Number(price),
      compareAtPrice: compareAtPrice != null ? Number(compareAtPrice) : 0,
      images: Array.isArray(images) ? images.filter(Boolean) : [],
      categoryId: categoryId
        ? new mongoose.Types.ObjectId(categoryId)
        : undefined,
      inStock: inStock !== false,
      stockQuantity: Number(stockQuantity) || 0,
      sizes: Array.isArray(sizes) ? sizes : [],
      colors: Array.isArray(colors) ? colors : [],
      templateId: templateId
        ? new mongoose.Types.ObjectId(templateId)
        : undefined,
      order: Number(order) || 0,
      preOrder: preOrder === true,
      isSoldOut: isSoldOut === true,
    });
    const populated = await Product.findById(product._id)
      .populate("categoryId")
      .populate("templateId")
      .lean();
    res.status(201).json(populated);
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ message: "Slug already exists" });
    res.status(500).json({ message: err.message });
  }
});

// Batch reorder (avoid per-item DB updates)
// Body: { items: [{ id: string, order: number }] }
router.put("/reorder", async (req, res) => {
  try {
    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : null;
    if (!items || items.length === 0) {
      return res.status(400).json({ message: "items is required" });
    }

    const ops = items
      .map((it) => {
        const id = typeof it?.id === "string" ? it.id : "";
        const order = Number(it?.order);
        if (!id || !mongoose.isValidObjectId(id) || Number.isNaN(order))
          return null;
        return {
          updateOne: {
            filter: { _id: new mongoose.Types.ObjectId(id) },
            update: { $set: { order } },
          },
        };
      })
      .filter(Boolean);

    if (ops.length !== items.length) {
      return res.status(400).json({ message: "Invalid items" });
    }

    await Product.bulkWrite(ops, { ordered: false });
    res.json({ updated: ops.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const body = req.body || {};
    const updates = {};
    if (body.slug !== undefined) updates.slug = String(body.slug).trim();
    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.description !== undefined)
      updates.description = body.description?.trim() || "";
    if (body.price !== undefined) updates.price = Number(body.price);
    if (body.compareAtPrice !== undefined)
      updates.compareAtPrice = Number(body.compareAtPrice);
    if (body.images !== undefined)
      updates.images = Array.isArray(body.images)
        ? body.images.filter(Boolean)
        : [];
    if (body.categoryId !== undefined)
      updates.categoryId = body.categoryId
        ? new mongoose.Types.ObjectId(body.categoryId)
        : null;
    if (body.inStock !== undefined) updates.inStock = body.inStock !== false;
    if (body.stockQuantity !== undefined)
      updates.stockQuantity = Number(body.stockQuantity) || 0;
    if (body.sizes !== undefined)
      updates.sizes = Array.isArray(body.sizes) ? body.sizes : [];
    if (body.colors !== undefined)
      updates.colors = Array.isArray(body.colors) ? body.colors : [];
    if (body.templateId !== undefined)
      updates.templateId = body.templateId
        ? new mongoose.Types.ObjectId(body.templateId)
        : null;
    if (body.order !== undefined) updates.order = Number(body.order) || 0;
    if (body.preOrder !== undefined) updates.preOrder = body.preOrder === true;
    if (body.isSoldOut !== undefined) updates.isSoldOut = body.isSoldOut === true;

    const product = await Product.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    })
      .populate("categoryId")
      .populate("templateId")
      .lean();
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ message: "Slug already exists" });
    res.status(500).json({ message: err.message });
  }
});

router.patch("/:id/sold-out", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ message: "Invalid ID" });
    const { isSoldOut } = req.body || {};
    if (typeof isSoldOut !== "boolean")
      return res.status(400).json({ message: "isSoldOut (boolean) is required" });
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isSoldOut },
      { new: true },
    )
      .populate("categoryId")
      .populate("templateId")
      .lean();
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
