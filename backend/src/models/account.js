import mongoose from "mongoose";
const { ObjectId } = mongoose.Schema.Types;

const accountSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ["checking", "savings", "credit", "cash", "other"],
      required: true,
    },
    balance: { type: Number, required: true, default: 0 },
    currency: { type: String, required: true, default: "USD" },
    institution: { type: String }, // e.g., bank name
    last4: { type: String }, // last 4 digits of account number
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

export const Account = mongoose.model("Account", accountSchema);
