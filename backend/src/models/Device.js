import mongoose from "mongoose";

const DeviceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    // Stable identifier generated on mobile and stored in AsyncStorage
    deviceId: { type: String, required: true },

    expoPushToken: { type: String, required: true },
    platform: { type: String, enum: ["ios", "android"], required: true },
    appVersion: { type: String, default: "" },

    enabled: { type: Boolean, default: true },

    lastRegisteredAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// One device per user per deviceId
DeviceSchema.index({ userId: 1, deviceId: 1 }, { unique: true });

export default mongoose.model("Device", DeviceSchema);
