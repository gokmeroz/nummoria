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

    // NEW (optional): if provided on POST, the API will also create a *copy*
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
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

/* Helpful indexes */
transactionSchema.index({ userId: 1, isDeleted: 1, date: 1 });
transactionSchema.index({ userId: 1, accountId: 1, isDeleted: 1 });

export const Transaction = mongoose.model("Transaction", transactionSchema);
