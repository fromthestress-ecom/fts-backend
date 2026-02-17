import { Router } from "express";
import multer from "multer";
import { requireAdmin } from "../../middleware/requireAdmin.js";
import {
  r2Client,
  R2_BUCKET,
  R2_DIRECTORY,
  isR2Configured,
  getPublicUrl,
} from "../../config/cloudflare-r2.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";

const router = Router();
router.use(requireAdmin);

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận ảnh: JPEG, PNG, GIF, WebP"), false);
    }
  },
});

function getExtension(mimetype) {
  const map = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
  };
  return map[mimetype] || "jpg";
}

router.post("/", upload.single("file"), async (req, res) => {
  try {
    if (!isR2Configured()) {
      const accessKey = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || "";
      if (accessKey.length === 40) {
        return res.status(400).json({
          message:
            "CLOUDFLARE_R2_ACCESS_KEY_ID đang là Cloudflare API Token (40 ký tự). " +
            "Dùng R2 API Token: Cloudflare Dashboard → R2 → Manage R2 API Tokens → Create API token, " +
            "lấy Access Key ID (32 ký tự) và Secret (64 ký tự) điền vào .env",
        });
      }
      return res.status(503).json({
        message: "Cloudflare R2 chưa cấu hình (CLOUDFLARE_R2_*)",
      });
    }
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        message: "Gửi file với field name 'file' (multipart/form-data)",
      });
    }

    const ext = getExtension(req.file.mimetype);
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const key = `${R2_DIRECTORY}/${filename}`;

    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      })
    );

    const url = getPublicUrl(key);
    if (!url) {
      return res.status(500).json({
        message: "CLOUDFLARE_R2_PUBLIC_URL chưa cấu hình, không tạo được URL ảnh",
      });
    }

    res.status(201).json({
      url,
      key,
    });
  } catch (err) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "File tối đa 10MB" });
    }
    if (err.message && err.message.includes("Chỉ chấp nhận")) {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: err.message || "Upload thất bại" });
  }
});

export default router;
