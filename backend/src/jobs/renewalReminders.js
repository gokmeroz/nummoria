// src/jobs/renewalReminders.js
import cron from "node-cron";
import { Subscription } from "../models/subscription.js";
import { User } from "../models/user.js";
import { sendRenewalReminderEmail } from "../utils/emailService.js";

// Which offsets to remind at
const REMINDER_DAYS = [7, 3, 1];

function daysBetween(a, b) {
  const MS = 1000 * 60 * 60 * 24;
  return Math.round((b - a) / MS);
}

async function runRenewalReminders() {
  const now = new Date();

  // Find active subscriptions that renew in <= 7 days and not expired
  const upper = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);

  const subs = await Subscription.find({
    status: "active",
    autoRenew: true,
    renewAt: { $gte: now, $lte: upper },
  }).lean();

  for (const sub of subs) {
    const renewAt = new Date(sub.renewAt);
    const daysLeft = daysBetween(now, renewAt);

    if (!REMINDER_DAYS.includes(daysLeft)) continue;
    if (sub.remindersSent?.includes(`${daysLeft}d`)) continue;

    const user = await User.findById(sub.user).lean();
    if (!user || !user.email) continue;

    await sendRenewalReminderEmail({
      to: user.email,
      name: user.name || "there",
      planName: sub.planName,
      renewAt,
      daysLeft,
    });

    // mark this reminder as sent
    await Subscription.updateOne(
      { _id: sub._id },
      { $addToSet: { remindersSent: `${daysLeft}d` } }
    );
  }
}

// run every hour (or every 10 min, up to you)
export function startRenewalReminderJob() {
  cron.schedule("0 * * * *", () => {
    runRenewalReminders().catch((err) =>
      console.error("[renewalReminders] error:", err)
    );
  });

  console.log("⏰ Renewal reminder cron registered (every hour).");
}
