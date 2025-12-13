// backend/src/workers/pushWorker.js
import { Worker } from "bullmq";
import { Expo } from "expo-server-sdk";

import Notification from "../models/Notification.js";
import Device from "../models/Device.js";
import { connection } from "../queues/pushQueue.js";

const expo = new Expo();

new Worker(
  "pushQueue",
  async (job) => {
    const { notificationId } = job.data;

    const notif = await Notification.findById(notificationId);
    if (!notif) return;

    const devices = await Device.find({
      userId: notif.userId,
      isActive: true,
    });

    const messages = [];

    for (const device of devices) {
      if (!Expo.isExpoPushToken(device.expoPushToken)) continue;

      messages.push({
        to: device.expoPushToken,
        sound: "default",
        title: notif.title,
        body: notif.body,
        data: notif.data || {},
      });
    }

    if (!messages.length) return;

    const chunks = expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
      } catch (err) {
        console.error("[push-worker] expo error", err);
      }
    }

    notif.status = "sent";
    notif.sentAt = new Date();
    await notif.save();
  },
  { connection }
);

console.log("[push-worker] worker online");
