// backend/src/controllers/adminActivityController.js
import mongoose from "mongoose";
import ActivityEvent from "../models/ActivityEvent.js";
import { User } from "../models/user.js";

function parseTypes(typesRaw) {
  if (!typesRaw) return null;
  return String(typesRaw)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseCursor(cursorRaw) {
  if (!cursorRaw) return null;
  const d = new Date(cursorRaw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function parseLimit(limitRaw) {
  const n = parseInt(limitRaw || "50", 10);
  if (Number.isNaN(n) || n <= 0) return 50;
  return Math.min(n, 200);
}

// GET /admin/users/:userId/activity
export async function adminGetUserActivity(req, res) {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user id." });
    }

    const limit = parseLimit(req.query.limit);
    const cursor = parseCursor(req.query.cursor);
    const types = parseTypes(req.query.types);

    const q = {
      userId: new mongoose.Types.ObjectId(userId),
    };

    if (cursor) {
      q.ts = { $lt: cursor };
    }

    if (types?.length) {
      q.type = { $in: types };
    }

    const items = await ActivityEvent.find(q)
      .sort({ ts: -1 })
      .limit(limit)
      .select("type ts title subtitle meta adminEmail adminId payload")
      .lean();

    const nextCursor = items.length
      ? new Date(items[items.length - 1].ts).toISOString()
      : null;

    return res.json({
      items,
      nextCursor,
    });
  } catch (e) {
    console.error("adminGetUserActivity error:", e);
    return res.status(500).json({ message: "Failed to load activity." });
  }
}

// PATCH /admin/users/:id/role
export async function updateUserRole(req, res) {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user id." });
    }

    const normalizedRole = String(role || "")
      .trim()
      .toLowerCase();

    if (!["user", "admin"].includes(normalizedRole)) {
      return res.status(400).json({ message: "Invalid role." });
    }

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found." });
    }

    // Prevent self-demotion
    if (
      String(req.user?._id) === String(targetUser._id) &&
      normalizedRole !== "admin"
    ) {
      return res.status(400).json({
        message: "You cannot remove your own admin role.",
      });
    }

    targetUser.role = normalizedRole;
    await targetUser.save();

    return res.json({
      message: "User role updated successfully.",
      user: targetUser,
    });
  } catch (error) {
    console.error("updateUserRole error:", error);
    return res.status(500).json({ message: "Failed to update user role." });
  }
}

// GET /admin/activity
export async function adminGetGlobalActivity(req, res) {
  try {
    const limit = parseLimit(req.query.limit);
    const cursor = parseCursor(req.query.cursor);
    const types = parseTypes(req.query.types);
    const actorType = req.query.actorType ? String(req.query.actorType) : null;
    const userId = req.query.userId ? String(req.query.userId) : null;

    const q = {};

    if (cursor) q.ts = { $lt: cursor };
    if (types?.length) q.type = { $in: types };
    if (actorType) q.actorType = actorType;

    if (userId) {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: "Invalid userId filter." });
      }
      q.userId = new mongoose.Types.ObjectId(userId);
    }

    const items = await ActivityEvent.find(q)
      .sort({ ts: -1 })
      .limit(limit)
      .populate("userId", "name email")
      .lean();

    const nextCursor = items.length
      ? new Date(items[items.length - 1].ts).toISOString()
      : null;

    return res.json({ items, nextCursor });
  } catch (e) {
    console.error("adminGetGlobalActivity error:", e);
    return res.status(500).json({ message: "Failed to load global activity." });
  }
}
