import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: [
        "monthly.summary_ready",
        "budget.threshold_crossed",
        "expense.anomaly_detected",
        "transaction.reminder", // ✅ add
        "test",
      ],
      required: true,
    },

    title: { type: String, required: true },
    body: { type: String, required: true },

    data: { type: Object, default: {} },

    status: {
      type: String,
      enum: ["queued", "sent", "failed"],
      default: "queued",
    },
    sentAt: { type: Date, default: null },
    readAt: { type: Date, default: null },

    providerMessageId: { type: String, default: "" },
    error: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("Notification", NotificationSchema);
