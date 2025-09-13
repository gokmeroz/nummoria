import mongoose from "mongoose";
const { ObjectId } = mongoose.Schema.Types;

const categorySchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true },
    parentId: { type: ObjectId, ref: "Category", index: true },
    kind: {
      type: String,
      enum: ["income", "expense"],
      required: true,
      index: true,
    },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

export const Category = mongoose.model("Category", categorySchema);
