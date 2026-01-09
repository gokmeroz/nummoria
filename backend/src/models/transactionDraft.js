// backend/src/models/transactionDraft.js
import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

const transactionDraftSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: "User", required: true, index: true },
    accountId: { type: ObjectId, ref: "Account", required: true, index: true },

    status: {
      type: String,
      enum: ["draft", "posted", "rejected"],
      default: "draft",
      index: true,
    },

    source: {
      type: String,
      enum: ["text", "receipt", "bank", "csv"],
      default: "text",
      index: true,
    },

    // candidate payload that will become a Transaction
    candidate: {
      type: {
        type: String,
        enum: ["income", "expense", "transfer", "investment"],
        required: true,
        index: true,
      },
      categoryId: { type: ObjectId, ref: "Category", default: null },
      amountMinor: { type: Number, required: true },
      currency: { type: String, required: true },
      date: { type: Date, required: true },

      nextDate: { type: Date, default: null },
      reminder: {
        enabled: { type: Boolean, default: false },
        offsetMinutes: { type: Number, default: 1440 },
      },

      description: { type: String, default: null },
      notes: { type: String, default: null },
      tags: [{ type: String }],

      assetSymbol: { type: String, default: null },
      units: { type: Number, default: null },
    },

    raw: {
      text: { type: String, default: null }, // original user text or OCR text
    },

    confidence: { type: Number, default: 0.0 },
    reasons: [{ type: String }],

    dedupeKey: { type: String, index: true, default: null },

    postedTransactionId: { type: ObjectId, ref: "Transaction", default: null },
    rejectedReason: { type: String, default: null },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } }
);

// helpful indexes
transactionDraftSchema.index({ userId: 1, status: 1, createdAt: -1 });
transactionDraftSchema.index({ userId: 1, accountId: 1, status: 1 });

export const TransactionDraft = mongoose.model(
  "TransactionDraft",
  transactionDraftSchema
);
