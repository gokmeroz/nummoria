// backend/src/utils/logAdminEventSafe.js
import mongoose from "mongoose";
import ActivityEvent from "../models/ActivityEvent.js";

// A safe logger: never throws to avoid breaking admin actions
export async function logAdminEventSafe({
  userId,
  admin,
  // ✅ NEW: event type used for filters
  type = "admin_event",

  // display fields
  title,
  subtitle = "",
  meta = "",

  // ✅ NEW: allows overriding timestamp
  ts = new Date(),

  // structured payload
  payload = {},
}) {
  try {
    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) return;

    const adminId =
      admin?._id && mongoose.Types.ObjectId.isValid(String(admin._id))
        ? admin._id
        : null;

    const adminEmail = admin?.email ? String(admin.email) : "";

    await ActivityEvent.create({
      userId,
      adminId,
      adminEmail,
      type: String(type || "admin_event"),
      ts: ts instanceof Date && !Number.isNaN(ts.getTime()) ? ts : new Date(),
      title: String(title || "Admin event"),
      subtitle: String(subtitle || ""),
      meta: String(meta || ""),
      payload: payload ?? {},
    });
  } catch (e) {
    console.error("logAdminEventSafe error:", e);
  }
}
