// src/models/subscription.js
import mongoose from "mongoose";

const { Schema, Types } = mongoose;

const subscriptionSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: "User", required: true },
    planName: { type: String, required: true }, // "Plus", "Premium", etc.
    status: {
      type: String,
      enum: ["active", "canceled", "expired"],
      default: "active",
    },
    renewAt: { type: Date, required: true },
    autoRenew: { type: Boolean, default: true },

    // track which reminders were already sent to avoid duplicates
    remindersSent: {
      type: [String], // e.g. ["7d", "3d", "1d"]
      default: [],
    },
  },
  { timestamps: true }
);

export const Subscription = mongoose.model("Subscription", subscriptionSchema);
