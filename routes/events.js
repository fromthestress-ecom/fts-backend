import { Router } from "express";
import { Event } from "../models/Event.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const now = new Date();
    const filter = {
      isActive: true,
      endDate: { $gte: now },
    };
    const list = await Event.find(filter).sort({ startDate: 1 }).lean();
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:slug", async (req, res) => {
  try {
    const event = await Event.findOne({ slug: req.params.slug }).lean();
    if (!event) return res.status(404).json({ message: "Event not found" });
    res.json(event);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
