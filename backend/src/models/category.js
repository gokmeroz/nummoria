import mongoose from "mongoose";
const { ObjectId } = mongoose.Schema.Types;

const categorySchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: "User", required: true, index: true },
    name: {
      type: String,
      enum: [
        "Salary",
        "Investment",
        "Rentals",
        "Business Income & Freelance",
        "Other Income",
        "Rent",
        "Housing Payments & Maintenance",
        "Debt Payments",
        "Transportation",
        "Health & Medical",
        "Utilities",
        "Groceries",
        "Dining Out",
        "Education",
        "Miscellaneous",
        "Entertainment",
        "Travel",
        "Gifts & Donations",
        "Personal Care",
        "Shopping",
        "Subscriptions",
        "Taxes",
        "Insurance",
        "Business Expenses",
        "Other Expense",
      ],
      required: true,
    },
    // parentId: { type: ObjectId, ref: "Category", index: true },
    kind: {
      type: String,
      enum: ["income", "expense"],
      required: true,
      index: true,
    },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

export const Category = mongoose.model("Category", categorySchema);
