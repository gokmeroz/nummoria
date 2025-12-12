import { Worker } from "bullmq";
import { connection } from "../queues/pushQueue.js";

import Notification from "../models/Notification.js";
import Device from "../models/Device.js";
import { Expo } from "expo-server-sdk";

const expo = new Expo();

new Worker(
  "pushQueue",
  async (job) => {
    const { notificationId } = job.data;

    const notif = await Notification.findById(notificationId);
    if (!notif) return;

    const devices = await Device.find({
      userId: notif.userId,
      enabled: true,
    });

    const messages = devices
      .filter((d) => Expo.isExpoPushToken(d.expoPushToken))
      .map((d) => ({
        to: d.expoPushToken,
        sound: "default",
        title: notif.title,
        body: notif.body,
        data: notif.data || {},
      }));

    if (messages.length === 0) return;

    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk);
    }
  },
  {
    connection, // ✅ SAME connection with maxRetriesPerRequest: null
  }
);

console.log("[push-worker] worker online");
