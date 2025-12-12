import express from "express";
import Notification from "../models/Notification.js";
import { pushQueue } from "../queues/pushQueue.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const userId = req.user.id;
  const limit = Math.min(Number(req.query.limit || 20), 50);
  const cursor = req.query.cursor; // ISO date string

  const query = { userId };
  if (cursor) query.createdAt = { $lt: new Date(cursor) };

  const items = await Notification.find(query)
    .sort({ createdAt: -1 })
    .limit(limit + 1);

  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;

  const nextCursor = hasMore
    ? page[page.length - 1].createdAt.toISOString()
    : null;

  res.json({ items: page, nextCursor });
});

router.post("/:id/read", async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const updated = await Notification.findOneAndUpdate(
    { _id: id, userId },
    { $set: { readAt: new Date() } },
    { new: true }
  );

  if (!updated) return res.status(404).json({ message: "Not found" });
  res.json({ ok: true, notification: updated });
});

router.post("/read-all", async (req, res) => {
  const userId = req.user.id;
  await Notification.updateMany(
    { userId, readAt: null },
    { $set: { readAt: new Date() } }
  );
  res.json({ ok: true });
});

// Dev endpoint: creates a notification record + enqueues send
router.post("/test", async (req, res) => {
  const userId = req.user.id;

  const notif = await Notification.create({
    userId,
    type: "test",
    title: "Nummoria Test Notification",
    body: "If you tapped this, deep linking should work.",
    data: {
      type: "test",
      route: "Reports",
      params: { from: "notification_test" },
    },
    status: "queued",
  });

  await pushQueue.add(
    "sendPush",
    { notificationId: notif._id.toString() },
    { attempts: 3 }
  );

  res.json({ ok: true, notificationId: notif._id });
});

export default router;
