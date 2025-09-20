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
    amountMinor: { type: Number, required: true }, // amount in minor units (e.g., cents)
    currency: { type: String, required: true },
    date: { type: Date, required: true, index: true },

    description: { type: String },
    notes: { type: String },
    tags: [{ type: String }],

    assetSymbol: { type: String, trim: true, index: true }, // e.g. AAPL, BTC-USD, VOO
    units: { type: Number }, // e.g. 2.5 shares/coinss
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

export const Transaction = mongoose.model("Transaction", transactionSchema);
