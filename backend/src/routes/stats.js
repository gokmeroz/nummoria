// backend/src/routes/stats.js
import express from "express";
import { User } from "../models/user.js";
import { Transaction } from "../models/transaction.js"; // unified model

const router = express.Router();

router.get("/", async (_req, res) => {
  try {
    // 🧮 exact user count
    const activeUsers = await User.countDocuments({});

    // 🧾 get all transaction stats grouped by type
    const txAgg = await Transaction.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      {
        $group: {
          _id: "$type", // e.g. "income", "expense", "investment"
          totalAmount: { $sum: "$amountMinor" }, // adjust if your field name differs
        },
      },
    ]);

    // convert aggregation result into an object
    const totals = txAgg.reduce((acc, t) => {
      acc[t._id] = t.totalAmount;
      return acc;
    }, {});

    // calculate tracked volume = all transaction types combined
    const trackedVolumeMinor =
      (totals.income || 0) + (totals.expense || 0) + (totals.investment || 0);

    // demo value — can replace later with real analytics
    const avgSetupTime = 3; // minutes

    res.json({
      activeUsers,
      trackedVolumeMinor,
      breakdown: {
        income: totals.income || 0,
        expense: totals.expense || 0,
        investment: totals.investment || 0,
      },
      avgSetupTime,
      platforms: "Web • Mobile",
    });
  } catch (err) {
    console.error("STATS ERROR:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default router;
