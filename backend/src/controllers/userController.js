import { User } from "../models/user.js";

const CURRENT_CONSENT_VERSION = "v1";

function buildConsentPayload(user) {
  return {
    accepted: !!user?.consent?.accepted,
    acceptedAt: user?.consent?.acceptedAt || null,
    version: user?.consent?.version || null,
    currentVersion: CURRENT_CONSENT_VERSION,
    needsAcceptance:
      !user?.consent?.accepted ||
      user?.consent?.version !== CURRENT_CONSENT_VERSION,
  };
}

export async function getMe(req, res) {
  try {
    const user = await User.findById(req.userId).select("-passwordHash").lean();

    if (!user) return res.status(404).json({ error: "User not found" });

    return res.json({
      ...user,
      consent: buildConsentPayload(user),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// GET /me/consent
export async function getMyConsent(req, res) {
  try {
    const user = await User.findById(req.userId).select("consent").lean();

    if (!user) return res.status(404).json({ error: "User not found" });

    return res.json({
      consent: buildConsentPayload(user),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// POST /me/consent
export async function acceptMyConsent(req, res) {
  try {
    const { accepted, version } = req.body || {};

    if (accepted !== true) {
      return res.status(400).json({
        error: "Consent must be explicitly accepted",
      });
    }

    const consentVersion = version || CURRENT_CONSENT_VERSION;

    const updated = await User.findByIdAndUpdate(
      req.userId,
      {
        $set: {
          consent: {
            accepted: true,
            acceptedAt: new Date(),
            version: consentVersion,
          },
        },
      },
      {
        new: true,
        runValidators: true,
        lean: true,
      },
    ).select("-passwordHash");

    if (!updated) return res.status(404).json({ error: "User not found" });

    return res.status(200).json({
      ok: true,
      consent: buildConsentPayload(updated),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// PUT/PATCH /me
export async function updateMe(req, res) {
  try {
    const updates = {};
    const whitelist = [
      "name",
      "email",
      "profession",
      "tz",
      "baseCurrency",
      "avatarUrl",
    ];

    for (const key of whitelist) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No updatable fields provided" });
    }

    const updated = await User.findOneAndUpdate(
      { _id: req.userId },
      { $set: updates },
      { new: true, runValidators: true, lean: true },
    );

    if (!updated) return res.status(404).json({ error: "User not found" });

    return res.status(200).json({
      ...updated,
      consent: buildConsentPayload(updated),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function softDeleteMe(req, res) {
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.isActive = false;
    await user.save();

    return res.json({ message: "User account deleted successfully" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}