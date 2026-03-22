import { Router } from "express";
import mongoose from "mongoose";
import { Event } from "../../models/Event.js";
import { Product } from "../../models/Product.js";
import { requireAdmin } from "../../middleware/requireAdmin.js";

const router = Router();
router.use(requireAdmin);

router.get("/", async (req, res) => {
  try {
    const list = await Event.find().sort({ createdAt: -1 }).lean();
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ message: "Invalid ID" });
    const event = await Event.findById(req.params.id).lean();
    if (!event) return res.status(404).json({ message: "Event not found" });
    res.json(event);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const {
      name,
      slug,
      description,
      bannerImage,
      discountType,
      discountValue,
      startDate,
      endDate,
      isActive,
    } = req.body || {};

    if (!name || !slug || !discountType || discountValue == null || !startDate || !endDate) {
      return res.status(400).json({
        message: "name, slug, discountType, discountValue, startDate, endDate are required",
      });
    }

    if (new Date(endDate) <= new Date(startDate)) {
      return res.status(400).json({ message: "endDate must be after startDate" });
    }

    if (discountType === "percent" && (discountValue < 0 || discountValue > 100)) {
      return res.status(400).json({ message: "Percent discount must be between 0 and 100" });
    }

    const event = await Event.create({
      name: String(name).trim(),
      slug: String(slug).trim(),
      description: description?.trim() || undefined,
      bannerImage: bannerImage?.trim() || undefined,
      discountType,
      discountValue: Number(discountValue),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isActive: isActive !== false,
    });

    res.status(201).json(event);
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ message: "Slug already exists" });
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ message: "Invalid ID" });

    const body = req.body || {};
    const updates = {};
    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.slug !== undefined) updates.slug = String(body.slug).trim();
    if (body.description !== undefined) updates.description = body.description?.trim() || "";
    if (body.bannerImage !== undefined) updates.bannerImage = body.bannerImage?.trim() || "";
    if (body.discountType !== undefined) updates.discountType = body.discountType;
    if (body.discountValue !== undefined) updates.discountValue = Number(body.discountValue);
    if (body.startDate !== undefined) updates.startDate = new Date(body.startDate);
    if (body.endDate !== undefined) updates.endDate = new Date(body.endDate);
    if (body.isActive !== undefined) updates.isActive = body.isActive === true;

    if (updates.discountType === "percent" && updates.discountValue != null) {
      if (updates.discountValue < 0 || updates.discountValue > 100) {
        return res.status(400).json({ message: "Percent discount must be between 0 and 100" });
      }
    }

    const event = await Event.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).lean();
    if (!event) return res.status(404).json({ message: "Event not found" });
    res.json(event);
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ message: "Slug already exists" });
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ message: "Invalid ID" });

    // Remove eventId from all products linked to this event
    await Product.updateMany(
      { eventId: new mongoose.Types.ObjectId(req.params.id) },
      { $unset: { eventId: "" } },
    );

    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
