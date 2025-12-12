import express from "express";
import Device from "../models/Device.js";

const router = express.Router();

// Assumes you already have auth middleware that sets req.user.id
router.post("/register", async (req, res) => {
  try {
    const userId = req.user.id;
    const { expoPushToken, platform, deviceId, appVersion } = req.body || {};

    if (!expoPushToken || !platform || !deviceId) {
      return res
        .status(400)
        .json({ message: "expoPushToken, platform, deviceId are required" });
    }
    if (!["ios", "android"].includes(platform)) {
      return res
        .status(400)
        .json({ message: "platform must be ios or android" });
    }

    const doc = await Device.findOneAndUpdate(
      { userId, deviceId },
      {
        userId,
        deviceId,
        expoPushToken,
        platform,
        appVersion: appVersion || "",
        enabled: true,
        lastRegisteredAt: new Date(),
        lastSeenAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json({ ok: true, device: doc });
  } catch (err) {
    // Handle duplicate index race
    if (err?.code === 11000) {
      return res
        .status(409)
        .json({ message: "Device already registered. Retry." });
    }
    return res.status(500).json({ message: "Failed to register device" });
  }
});

router.post("/disable", async (req, res) => {
  try {
    const userId = req.user.id;
    const { deviceId } = req.body || {};
    if (!deviceId)
      return res.status(400).json({ message: "deviceId is required" });

    await Device.updateOne({ userId, deviceId }, { $set: { enabled: false } });
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ message: "Failed to disable device" });
  }
});

export default router;
