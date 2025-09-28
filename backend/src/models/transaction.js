import mongoose from "mongoose";
const { ObjectId } = mongoose.Schema.Types;

/* ---------- Recurrence rule subdocument ---------- */
const recurrenceRuleSchema = new mongoose.Schema(
  {
    // template flag: this row is the recurrence definition (no balance impact)
    isTemplate: { type: Boolean, default: false, index: true },

    // if this is a generated instance, points to the template _id
    parentId: { type: ObjectId, ref: "Transaction", index: true },

    // schedule
    frequency: {
      type: String,
      enum: ["none", "daily", "weekly", "monthly", "yearly"],
      default: "none",
      index: true,
    },
    interval: { type: Number, default: 1, min: 1 }, // every N units

    // anchors & bounds
    startDate: { type: Date }, // when recurrence begins
    endDate: { type: Date }, // optional
    maxOccurrences: { type: Number, min: 1 }, // optional cap

    // monthly/yearly helpers
    byMonthDay: { type: Number, min: 1, max: 31 }, // e.g., 1 -> “on the 1st”
    // weekly helper: 0..6 (Sun..Sat)
    byWeekday: [{ type: Number, min: 0, max: 6 }],

    // operational
    nextRunAt: { type: Date, index: true }, // when to generate the next instance
    lastRunAt: { type: Date }, // last generation time

    // autopost behavior
    autopost: {
      type: String,
      enum: ["post", "preview"], // post -> create instance immediately; preview -> only surface as suggestion (no balance)
      default: "post",
    },
  },
  { _id: false }
);

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
    date: { type: Date, required: true, index: true },

    description: { type: String },
    notes: { type: String },
    tags: [{ type: String }],

    // investments
    assetSymbol: { type: String, trim: true, index: true },
    units: { type: Number },

    // soft delete
    isDeleted: { type: Boolean, default: false, index: true },

    // recurrence
    recurrence: { type: recurrenceRuleSchema, default: undefined },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

/* Helpful compound indexes */
transactionSchema.index({
  "recurrence.isTemplate": 1,
  userId: 1,
  isDeleted: 1,
});
transactionSchema.index({ "recurrence.parentId": 1, userId: 1, isDeleted: 1 });

export const Transaction = mongoose.model("Transaction", transactionSchema);
