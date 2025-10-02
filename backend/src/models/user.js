import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    resetPasswordTokenHash: { type: String },
    resetPasswordExpiresAt: { type: Date },
    lastLogin: { type: Date },
    isActive: { type: Boolean, default: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    profession: { type: String },
    tz: { type: String, default: "UTC" },
    baseCurrency: { type: String, default: "USD" },
    avatarUrl: { type: String, default: null },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

export const User = mongoose.model("User", userSchema);
