import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { connectDb } from "./config/db.js";
import categories from "./routes/categories.js";
import products from "./routes/products.js";
import auth from "./routes/auth.js";
import cart from "./routes/cart.js";
import orders from "./routes/orders.js";
import adminCategories from "./routes/admin/categories.js";
import adminProducts from "./routes/admin/products.js";
import adminAuth from "./routes/admin/auth.js";
import adminUpload from "./routes/admin/upload.js";

const app = express();
const port = Number(process.env.PORT) || 4000;
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";

app.use(helmet());
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());

app.use("/categories", categories);
app.use("/products", products);
app.use("/auth", auth);
app.use("/cart", cart);
app.use("/orders", orders);
app.use("/admin/auth", adminAuth);
app.use("/admin/categories", adminCategories);
app.use("/admin/products", adminProducts);
app.use("/admin/upload", adminUpload);
app.use("/admin", express.static("admin"));

app.get("/health", (req, res) => res.json({ ok: true }));

app.use((err, _req, res, _next) => {
  if (err.message && err.message.includes("Chỉ chấp nhận")) {
    return res.status(400).json({ message: err.message });
  }
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ message: "File tối đa 10MB" });
  }
  res.status(500).json({ message: err.message || "Internal error" });
});

connectDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`API running at http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error("DB connection failed:", err);
    process.exit(1);
  });
