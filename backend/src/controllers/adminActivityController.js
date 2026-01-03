// backend/src/controllers/adminActivityController.js
import mongoose from "mongoose";
import ActivityEvent from "../models/ActivityEvent.js";

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
    const actorType = req.query.actorType ? String(req.query.actorType) : null;

    const q = { userId: new mongoose.Types.ObjectId(userId) };

    if (cursor) q.ts = { $lt: cursor };
    if (types?.length) q.type = { $in: types };
    if (actorType) q.actorType = actorType;

    const items = await ActivityEvent.find(q)
      .sort({ ts: -1 })
      .limit(limit)
      .lean();

    const nextCursor = items.length
      ? new Date(items[items.length - 1].ts).toISOString()
      : null;

    return res.json({ items, nextCursor });
  } catch (e) {
    console.error("adminGetUserActivity error:", e);
    return res.status(500).json({ message: "Failed to load activity." });
  }
}

// GET /admin/activity (global)
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
      .populate("userId", "name email") // optional: makes admin UI nicer
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
