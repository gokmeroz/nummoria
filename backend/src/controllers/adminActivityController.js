// backend/src/controllers/adminActivityController.js
import mongoose from "mongoose";
import ActivityEvent from "../models/ActivityEvent.js";

export async function adminGetUserActivity(req, res) {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user id." });
    }

    const limit = Math.min(parseInt(req.query.limit || "50", 10), 200);

    const cursor = req.query.cursor ? new Date(req.query.cursor) : null;

    const types = req.query.types
      ? String(req.query.types)
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean)
      : null;

    const q = { userId };

    if (cursor && !Number.isNaN(cursor.getTime())) {
      q.ts = { $lt: cursor };
    }

    if (types && types.length) {
      q.type = { $in: types };
    }

    const items = await ActivityEvent.find(q)
      .sort({ ts: -1 })
      .limit(limit)
      .lean();

    const nextCursor = items.length
      ? new Date(items[items.length - 1].ts).toISOString()
      : null;

    return res.json({ items, nextCursor });
  } catch (e) {
    return res.status(500).json({ message: "Failed to load activity." });
  }
}
