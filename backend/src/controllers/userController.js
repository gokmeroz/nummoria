import { User } from "../models/user.js";

export async function getMe(req, res) {
  try {
    // Fetch user by ID from req.userId set by auth middleware
    const user = await User.findById(req.userId)
      .select("-passwordHash") // Exclude passwordHash from the result
      .lean(); // Convert Mongoose document to plain JS object

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PUT/PATCH /me
export async function updateMe(req, res) {
  try {
    const updates = {};
    const whitelist = ["name", "email", "profession", "tz", "baseCurrency"];
    for (const key of whitelist) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No updatable fields provided" });
    }

    const updated = await User.findOneAndUpdate(
      { _id: req.userId }, // ← trust JWT
      { $set: updates },
      { new: true, runValidators: true, lean: true }
    );

    if (!updated) return res.status(404).json({ error: "User not found" });
    return res.status(200).json(updated);
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

    user.isActive = false; // Soft delete by setting isActive to false
    await user.save();
    res.json({ message: "User account deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
