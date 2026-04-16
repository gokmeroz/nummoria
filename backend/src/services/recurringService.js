// backend/src/services/recurringService.js
import cron from "node-cron";
import Transaction from "../models/transaction"; // Adjust path to your Mongoose model

// Runs every day at 00:05 AM Server Time
export const startRecurringExpenseCron = () => {
  cron.schedule("5 0 * * *", async () => {
    console.log("[CRON] Checking for recurring transactions...");

    try {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      // 1. Find all templates that have a frequency
      // We look for ones where the nextProcessedDate is today or earlier
      const recurringTx = await Transaction.find({
        frequency: { $in: ["daily", "weekly", "monthly", "yearly"] },
        nextProcessedDate: { $lte: today },
        $or: [{ endDate: null }, { endDate: { $gte: today } }],
      });

      if (!recurringTx.length) {
        return console.log("[CRON] No recurring transactions due today.");
      }

      for (const template of recurringTx) {
        // 2. Clone the transaction as a fresh, actual expense
        const newExpense = new Transaction({
          accountId: template.accountId,
          categoryId: template.categoryId,
          type: template.type,
          amountMinor: template.amountMinor,
          currency: template.currency,
          date: today,
          description: template.description || "Recurring Expense",
          tags: template.tags,
          // Important: We strip frequency from the child so it doesn't clone itself
        });

        await newExpense.save();

        // 3. Calculate the NEXT processing date for the template
        const nextDate = new Date(today);
        if (template.frequency === "daily")
          nextDate.setUTCDate(nextDate.getUTCDate() + 1);
        if (template.frequency === "weekly")
          nextDate.setUTCDate(nextDate.getUTCDate() + 7);
        if (template.frequency === "monthly")
          nextDate.setUTCMonth(nextDate.getUTCMonth() + 1);
        if (template.frequency === "yearly")
          nextDate.setUTCFullYear(nextDate.getUTCFullYear() + 1);

        // 4. Update the template's next processing date
        template.nextProcessedDate = nextDate;
        await template.save();

        console.log(
          `[CRON] Generated recurring expense for: ${template.description}`,
        );
      }
    } catch (error) {
      console.error("[CRON] Failed to process recurring transactions:", error);
    }
  });
};
