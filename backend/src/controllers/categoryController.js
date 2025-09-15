import mongoose from "mongoose";
import { Category } from "../models/category.js";
const { ObjectId } = mongoose.Types;

/** GET /categories */
export async function getCategories(req, res) {
  try {
    const categories = await Category.find(
      { userId: req.userId, isDeleted: { $ne: true } },
      null,
      { lean: true }
    );

    // Return 200 with empty array if none (not 404)
    return res.status(200).json(categories);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** GET /accounts/:id */
export async function getCategoryById(req, res) {
  try {
    const { id } = req.params;

    // ✅ validate ObjectId properly
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid category id" });
    }

    // ✅ make sure category belongs to the logged-in user & is not deleted
    const category = await Category.findOne({
      _id: id,
      userId: req.userId,
      isDeleted: { $ne: true },
    }).lean();

    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    return res.status(200).json(category);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
/** POST /categories */
export async function createCategory(req, res) {
  try {
    const { name, kind } = req.body;
    if (!name || !kind) {
      return res.status(400).json({ error: "Name and type are required" });
    }

    const doc = await Category.create({
      userId: req.userId,
      name,
      kind, // must exist in schema enum if you validate it
      isDeleted: false,
    });

    return res.status(201).json(doc);
  } catch (err) {
    // Typical validation errors show up here
    return res.status(500).json({ error: err.message });
  }
}

/** PUT/PATCH /categories/:id */
export async function updateCategory(req, res) {
  try {
    const { id } = req.params; // /:id from route
    if (!ObjectId.isValid(id))
      return res.status(400).json({ error: "Invalid category id" });

    const updates = {};
    const whitelist = ["name", "kind"];
    for (const key of whitelist) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No updatable fields provided" });
    }

    const updated = await Category.findOneAndUpdate(
      { _id: id, userId: req.userId, isDeleted: { $ne: true } },
      { $set: updates },
      { new: true, runValidators: true, lean: true }
    ).lean();

    if (!updated) return res.status(404).json({ error: "Category not found" });
    return res.status(200).json(updated);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** DELETE /categories/:id (soft) -> sets isDeleted: true */
export async function softDeleteCategory(req, res) {
  try {
    const { id } = req.params; // /:id from route
    if (!ObjectId.isValid(id))
      return res.status(400).json({ error: "Invalid category id" });

    const updated = await Category.findOneAndUpdate(
      { _id: id, userId: req.userId, isDeleted: { $ne: true } }, // only non-deleted
      { $set: { isDeleted: true } }, // soft delete
      { new: true, lean: true } // return updated doc
    );

    if (!updated)
      return res
        .status(404)
        .json({ error: "Category not found or already deleted" });
    return res.status(200).json({ message: "Category soft-deleted", id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** DELETE /accounts/:id/hard (hard) -> permanently remove (and optionally cascade) */
export async function hardDeleteCategory(req, res) {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id))
      return res.status(400).json({ error: "Invalid category id" });

    // Optional: also delete related transactions
    // await Transaction.deleteMany({ userId: req.userId, accountId: id });

    const result = await Category.deleteOne({ _id: id, userId: req.userId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Category not found" });
    }
    return res
      .status(200)
      .json({ message: "Category permanently deleted", id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
