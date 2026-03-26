import "dotenv/config";
import { sendMail } from "./utils/mailer.js";

console.log("GMAIL_USER:", process.env.GMAIL_USER ? "SET" : "NOT SET");
console.log("GMAIL_APP_PASSWORD:", process.env.GMAIL_APP_PASSWORD ? "SET" : "NOT SET");
console.log("ADMIN_EMAIL:", process.env.ADMIN_EMAIL || "(not set, will use GMAIL_USER)");

const to = process.env.ADMIN_EMAIL || process.env.GMAIL_USER;

sendMail({
  to,
  subject: "[TEST] Email thong bao don hang",
  html: "<h2>Test email</h2><p>Neu ban nhan duoc email nay, he thong gui mail hoat dong binh thuong.</p>",
})
  .then((info) => {
    console.log("Email sent successfully!");
    console.log("Message ID:", info?.messageId);
  })
  .catch((err) => {
    console.error("Email FAILED:", err.message);
    console.error("Full error:", err);
  });