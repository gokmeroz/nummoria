// backend/src/models/ActivityEvent.js
import mongoose from "mongoose";

const ActivityEventSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      required: true,
    },

    // transaction | ai_message | ai_chat | import | login | password_reset | subscription_change | admin_action | other
    type: { type: String, default: "other", index: true },

    title: { type: String, default: "" },
    subtitle: { type: String, default: "" },
    meta: { type: String, default: "" },

    // Optional: where admin can jump
    href: { type: String, default: "" },

    // Who produced this event (important for admin audit)
    actorType: {
      type: String,
      enum: ["system", "user", "admin"],
      default: "system",
    },
    actorId: { type: mongoose.Schema.Types.ObjectId, default: null },

    // Optional debug payload (keep small)
    payload: { type: mongoose.Schema.Types.Mixed, default: null },

    ts: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

// Avoid OverwriteModelError in dev/hot reload
const ActivityEvent =
  mongoose.models.ActivityEvent ||
  mongoose.model("ActivityEvent", ActivityEventSchema);

export default ActivityEvent;
