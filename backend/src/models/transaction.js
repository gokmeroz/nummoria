// backend/src/models/transaction.js
import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

const transactionSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: "User", required: true, index: true },
    accountId: { type: ObjectId, ref: "Account", required: true, index: true },
    categoryId: { type: ObjectId, ref: "Category", index: true },

    type: {
      type: String,
      enum: ["income", "expense", "transfer", "investment"],
      required: true,
      index: true,
    },

    amountMinor: { type: Number, required: true }, // positive minor units
    currency: { type: String, required: true },
    date: { type: Date, required: true, index: true }, // the booked/plan date

    // NEW: The Recurring Engine Fields
    frequency: {
      type: String,
      enum: ["daily", "weekly", "monthly", "yearly"],
    },
    endDate: { type: Date },
    nextProcessedDate: { type: Date },

    // LEGACY (optional): if provided on POST, the API will also create a *copy*
    // for this date (future planned occurrence). This field is stored, but
    // has no special behavior beyond creation-time convenience.
    nextDate: { type: Date, index: true },

    reminder: {
      enabled: { type: Boolean, default: false },
      offsetMinutes: { type: Number, default: 1440 }, // 1 day
      remindAt: { type: Date, default: null }, // computed server-side
    },

    description: { type: String },
    notes: { type: String },
    tags: [{ type: String }],

    // investments (optional)
    assetSymbol: { type: String, trim: true, index: true, default: null },
    units: { type: Number, default: null }, // positive decimal, e.g. 1.5

    // soft delete
    isDeleted: { type: Boolean, default: false, index: true },

    // Statement-import provenance (absent on manually entered rows).
    // importId: sha256 of (userId, accountId, file bytes) — one per upload of
    //   one file into one account.
    // importRowKey: "date|amountMinor|type|description#n", n = how many
    //   identical rows came before it in the same file. Two genuinely
    //   identical coffees are #0 and #1, so they both persist; re-uploading
    //   the file produces the same keys, so nothing persists twice.
    importId: { type: String },
    importRowKey: { type: String },

    // Occurrence generated from a recurring template (services/recurringService.js):
    // the template's _id and the occurrence's scheduled date. Unique together,
    // so a retried or concurrent run can't book the same occurrence twice.
    recurrenceParentId: { type: ObjectId, ref: "Transaction" },
    recurrenceDate: { type: Date },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } },
);

/* Helpful indexes */
transactionSchema.index({ userId: 1, isDeleted: 1, date: 1 });
transactionSchema.index({ userId: 1, accountId: 1, isDeleted: 1 });
// Idempotent statement import: a retried or re-uploaded file cannot insert a
// row twice. Partial, so manual transactions (no importId) are unaffected.
transactionSchema.index(
  { userId: 1, importId: 1, importRowKey: 1 },
  { unique: true, partialFilterExpression: { importId: { $type: "string" } } },
);
transactionSchema.index(
  { recurrenceParentId: 1, recurrenceDate: 1 },
  { unique: true, partialFilterExpression: { recurrenceParentId: { $exists: true } } },
);

export const Transaction = mongoose.model("Transaction", transactionSchema);