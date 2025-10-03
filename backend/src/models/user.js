import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: {
      type: String,
      required: function () {
        return !this.googleId && !this.facebookId && !this.linkedinId;
      },
      select: false, // optional: keep it out of queries by default
    },
    resetPasswordTokenHash: { type: String },
    resetPasswordExpiresAt: { type: Date },
    lastLogin: { type: Date },
    isActive: { type: Boolean, default: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    profession: { type: String },
    tz: { type: String, default: "UTC" },
    baseCurrency: { type: String, default: "USD" },
    avatarUrl: { type: String },
    // Social ids (optional)
    googleId: { type: String, index: true, sparse: true, unique: false },
    facebookId: { type: String, index: true, sparse: true, unique: false },
    linkedinId: { type: String, index: true, sparse: true, unique: false },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

export const User = mongoose.model("User", userSchema);
