import mongoose from "mongoose";
import dns from "dns";

// Chỉ ép sử dụng Google DNS nếu có biến môi trường yêu cầu (hoặc mặc định chạy ở local)
// if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_DNS_FIX === 'true') {
//   dns.setServers(['8.8.8.8', '8.8.4.4']);
// }

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/streetwear";

export async function connectDb() {
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      family: 4,
    });
    console.log("Successfully connected to MongoDB.");
  } catch (err) {
    console.error(
      "Failed to connect to MongoDB with URI:",
      uri.replace(/\/\/.*@/, "//****:****@"),
    );
    throw err;
  }
}
