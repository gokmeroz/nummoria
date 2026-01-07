// backend/src/controllers/adminUserMetaController.js
import mongoose from "mongoose";
import { User } from "../models/user.js";
import ActivityEvent from "../models/ActivityEvent.js"; // optional logging (recommended)

function normalizeFlags(flags) {
  const arr = Array.isArray(flags) ? flags : [];
  const cleaned = arr
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .slice(0, 50);

  // unique (case-insensitive)
  const seen = new Set();
  const uniq = [];
  for (const f of cleaned) {
    const k = f.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(f);
  }
  return uniq;
}

async function logAdminEventSafe({
  userId,
  admin,
  title,
  subtitle,
  meta,
  payload,
}) {
  try {
    const adminId = admin?._id ? new mongoose.Types.ObjectId(admin._id) : null;

    await ActivityEvent.create({
      userId: new mongoose.Types.ObjectId(userId),
      type: "admin_action",
      title: title || "Admin action",
      subtitle: subtitle || "",
      meta: meta || "",
      actorType: "admin",
      actorId: adminId,
      payload: payload || null,
      ts: new Date(),
    });
  } catch (e) {
    // never block core admin flow because logging failed
    console.warn("admin meta: ActivityEvent log failed:", e?.message || e);
  }
}

// GET /admin/users/:userId/notes
export async function adminGetUserNotes(req, res) {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user id." });
    }

    const u = await User.findById(userId)
      .select("adminNotes")
      .populate("adminNotes.adminId", "name email role")
      .lean();

    if (!u) return res.status(404).json({ message: "User not found." });

    const notes = (u.adminNotes || []).sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return res.json({ notes });
  } catch (e) {
    console.error("adminGetUserNotes error:", e);
    return res.status(500).json({ message: "Failed to load notes." });
  }
}

// POST /admin/users/:userId/notes  body: { text }
export async function adminAddUserNote(req, res) {
  try {
    const { userId } = req.params;
    const text = String(req.body?.text || "").trim();

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user id." });
    }
    if (!text) {
      return res.status(400).json({ message: "Note text is required." });
    }
    if (text.length > 1500) {
      return res.status(400).json({ message: "Note is too long (max 1500)." });
    }

    // req.user should exist if your admin auth middleware attaches it
    const admin = req.user || null;

    const note = {
      text,
      adminId: admin?._id || null,
      adminEmail: admin?.email || "",
      createdAt: new Date(),
    };

    const u = await User.findByIdAndUpdate(
      userId,
      { $push: { adminNotes: note } },
      { new: true }
    )
      .select("adminNotes flags")
      .populate("adminNotes.adminId", "name email role");

    if (!u) return res.status(404).json({ message: "User not found." });

    await logAdminEventSafe({
      userId,
      admin,
      title: "Admin note added",
      subtitle: text.slice(0, 140),
      meta: admin?.email ? `by ${admin.email}` : "",
      payload: { notePreview: text.slice(0, 300) },
    });

    // Return latest notes (sorted in frontend, but we also can return all)
    return res.json({ notes: u.adminNotes, flags: u.flags || [] });
  } catch (e) {
    console.error("adminAddUserNote error:", e);
    return res.status(500).json({ message: "Failed to add note." });
  }
}

// PUT /admin/users/:userId/flags  body: { flags: string[] }
export async function adminUpdateUserFlags(req, res) {
  try {
    const { userId } = req.params;
    const nextFlags = normalizeFlags(req.body?.flags);

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user id." });
    }

    const admin = req.user || null;

    const u = await User.findByIdAndUpdate(
      userId,
      { $set: { flags: nextFlags } },
      { new: true }
    ).select("flags");

    if (!u) return res.status(404).json({ message: "User not found." });

    await logAdminEventSafe({
      userId,
      admin,
      type: "flags_updated",
      title: "User flags updated",
      subtitle: nextFlags.length ? nextFlags.join(", ") : "cleared",
      meta: admin?.email ? `by ${admin.email}` : "",
      payload: { flags: nextFlags },
    });

    return res.json({ flags: u.flags || [] });
  } catch (e) {
    console.error("adminUpdateUserFlags error:", e);
    return res.status(500).json({ message: "Failed to update flags." });
  }
}
