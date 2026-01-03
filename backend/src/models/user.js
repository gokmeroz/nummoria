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
      select: false,
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
    subscription: {
      type: String,
      enum: ["Standard", "Plus", "Premium"],
      default: "Standard",
    },

    // Social ids (optional)
    googleId: { type: String, index: true, sparse: true, unique: false },
    twitterId: { type: String, index: true, sparse: true, unique: false },
    githubId: { type: String, index: true, sparse: true, unique: false },

    //Email verification
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationCodeHash: { type: String, select: false },
    emailVerificationExpiresAt: { type: Date, select: false },
    emailVerifiedAt: Date,

    // NEW: force-logout support (invalidate tokens issued before this time)
    authInvalidBefore: { type: Date, default: null },
    // NEW: admin notes
    adminNotes: [
      {
        text: { type: String, default: "" },
        adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    flags: { type: [String], default: [] },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

export const User = mongoose.model("User", userSchema);
