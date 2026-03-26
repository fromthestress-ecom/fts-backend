import mongoose from "mongoose";
import crypto from "crypto";

function generateReferralCode(fullName) {
  const prefix = fullName
    .replace(/[^a-zA-Z0-9]/g, "")
    .substring(0, 5)
    .toUpperCase();
  const suffix = crypto.randomInt(1000, 9999);
  return `${prefix}${suffix}`;
}

const schema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, required: true },
    phone: String,
    role: { type: String, default: "customer" },
    referralCode: { type: String, unique: true, sparse: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    affiliateId: { type: mongoose.Schema.Types.ObjectId, ref: "Affiliate" },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
  },
  { timestamps: true },
);


// Auto-generate referralCode before save if not set
schema.pre("save", async function () {
  if (this.referralCode) return;
  let code;
  let exists = true;
  while (exists) {
    code = generateReferralCode(this.fullName);
    exists = await mongoose.model("User").findOne({ referralCode: code });
  }
  this.referralCode = code;
});

export const User = mongoose.model("User", schema);
