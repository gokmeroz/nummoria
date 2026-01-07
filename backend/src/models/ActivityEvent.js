// backend/src/models/ActivityEvent.js
import mongoose from "mongoose";

const ActivityEventSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: "User",
    },

    // who performed the action (optional for system events)
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      ref: "User",
      index: true,
    },
    adminEmail: { type: String, default: "" },

    // event classification for filtering
    type: {
      type: String,
      required: true,
      index: true,
      // keep this open-ended; you can enforce enum later
    },

    // authoritative event timestamp (used for cursor pagination)
    ts: {
      type: Date,
      required: true,
      default: () => new Date(),
      index: true,
    },

    title: { type: String, required: true },
    subtitle: { type: String, default: "" },
    meta: { type: String, default: "" },

    // arbitrary structured data for debugging/auditing
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    minimize: false,
    timestamps: true, // keeps createdAt/updatedAt too
  }
);

// Efficient pagination: newest first by ts
ActivityEventSchema.index({ userId: 1, ts: -1 });
ActivityEventSchema.index({ userId: 1, type: 1, ts: -1 });

export default mongoose.model("ActivityEvent", ActivityEventSchema);
