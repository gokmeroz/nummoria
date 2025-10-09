import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: {
      type: String,
      required: function () {
        return !this.googleId && !this.twitterId && !this.githubId;
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
    avatarUrl: { type: String, default: undefined },
    avatarVersion: { type: Number, default: 0 },

    // Social ids (optional)
    googleId: { type: String, index: true, sparse: true, unique: false },
    twitterId: { type: String, index: true, sparse: true, unique: false },
    githubId: { type: String, index: true, sparse: true, unique: false },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

export const User = mongoose.model("User", userSchema);
