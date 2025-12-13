// backend/src/controllers/deviceController.js
import Device from "../models/Device.js";

function normalizePlatform(p) {
  const v = String(p || "").toLowerCase();
  if (v === "ios" || v === "android") return v;
  return "unknown";
}

// POST /devices/register
export async function registerDevice(req, res) {
  try {
    const userId = req.userId;

    const { expoPushToken, platform, deviceName, modelName, osVersion } =
      req.body;

    if (!expoPushToken || typeof expoPushToken !== "string") {
      return res.status(400).json({ error: "expoPushToken is required" });
    }

    const doc = await Device.findOneAndUpdate(
      { userId, expoPushToken },
      {
        $set: {
          userId,
          expoPushToken,
          platform: normalizePlatform(platform),
          deviceName: deviceName || "",
          modelName: modelName || "",
          osVersion: osVersion || "",
          isActive: true,
          lastSeenAt: new Date(),
        },
      },
      { new: true, upsert: true }
    ).lean();

    return res.status(200).json({ ok: true, device: doc });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// POST /devices/heartbeat
export async function deviceHeartbeat(req, res) {
  try {
    const userId = req.userId;
    const { expoPushToken } = req.body;

    if (!expoPushToken) {
      return res.status(400).json({ error: "expoPushToken is required" });
    }

    await Device.updateOne(
      { userId, expoPushToken },
      { $set: { lastSeenAt: new Date(), isActive: true } }
    );

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
