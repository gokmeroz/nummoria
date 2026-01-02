// backend/src/utils/activityLog.js
const ActivityEvent = require("../models/ActivityEvent");

async function logActivity({
  userId,
  type,
  title,
  subtitle = "",
  meta = "",
  href = "",
  actorType = "system",
  actorId = null,
  payload = null,
  ts = new Date(),
}) {
  if (!userId) return;

  try {
    await ActivityEvent.create({
      userId,
      type,
      title,
      subtitle,
      meta,
      href,
      actorType,
      actorId,
      payload,
      ts,
    });
  } catch (e) {
    // Do not break flows if logging fails
  }
}

module.exports = { logActivity };
