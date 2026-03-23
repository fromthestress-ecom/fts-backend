import { Router } from "express";
import { requireAdmin } from "../../middleware/requireAdmin.js";
import { runBlogCrawl } from "../../utils/blogCrawlJob.js";

const router = Router();
router.use(requireAdmin);

// POST /admin/blog-crawl - trigger crawl manually
router.post("/", async (req, res) => {
  try {
    const limit = Math.min(10, Math.max(1, parseInt(req.body.limit, 10) || 3));
    const status = req.body.status === "published" ? "published" : "draft";

    const results = await runBlogCrawl({ limit, status });
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
