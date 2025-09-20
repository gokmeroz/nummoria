// backend/src/controllers/transactionController.js
import mongoose from "mongoose";
// If your file is backend/src/models/transactions.js (plural), use that path:
import { Transaction } from "../models/transaction.js"; // <- change to "../models/transactions.js" if that's your filename
import { Category } from "../models/category.js";

const { ObjectId } = mongoose.Types;

/** GET /transactions */
export async function getTransactions(req, res) {
  try {
    const filter = { userId: req.userId, isDeleted: { $ne: true } };

    if (req.query.accountId && ObjectId.isValid(req.query.accountId)) {
      filter.accountId = req.query.accountId;
    }
    if (req.query.categoryId && ObjectId.isValid(req.query.categoryId)) {
      filter.categoryId = req.query.categoryId;
    }

    const transactions = await Transaction.find(filter).lean();
    return res.status(200).json(transactions);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** GET /transactions/:id */
export async function getTransactionById(req, res) {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid transaction id" });
    }

    const transaction = await Transaction.findOne({
      _id: id,
      userId: req.userId,
      isDeleted: { $ne: true },
    }).lean();

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    return res.status(200).json(transaction);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** POST /transactions */
export async function createTransaction(req, res) {
  try {
    const {
      accountId,
      categoryId, // optional for transfer/investment
      type, // "income" | "expense" | "transfer" | "investment"
      amountMinor,
      currency,
      date,
      description,
      notes,
      tags,
      assetSymbol,
      units,
    } = req.body;

    // Basic required fields
    if (!accountId || !type || currency == null || date == null) {
      return res.status(400).json({
        error: "accountId, type, currency, and date are required",
      });
    }

    // amountMinor must be a number (can be 0)
    if (typeof amountMinor !== "number" || Number.isNaN(amountMinor)) {
      return res.status(400).json({ error: "amountMinor must be a number" });
    }

    // ObjectId validation
    if (!mongoose.Types.ObjectId.isValid(accountId)) {
      return res.status(400).json({ error: "Invalid accountId" });
    }
    if (categoryId && !mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({ error: "Invalid categoryId" });
    }

    // Type validation
    const allowedTypes = ["income", "expense", "transfer", "investment"];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ error: "Invalid type" });
    }

    // Enforce type ↔ category.kind consistency (if category provided)
    if (categoryId) {
      const cat = await Category.findOne({
        _id: categoryId,
        userId: req.userId,
        isDeleted: { $ne: true },
      })
        .select("kind")
        .lean();

      if (!cat) {
        return res.status(400).json({ error: "Category not found" });
      }
      // For income/expense/investment, category.kind must match type
      if (
        ["income", "expense", "investment"].includes(type) &&
        cat.kind !== type
      ) {
        return res.status(400).json({
          error: `Category kind (${cat.kind}) does not match transaction type (${type})`,
        });
      }
    }

    // Investment-specific validation
    if (type === "investment") {
      const sym = typeof assetSymbol === "string" ? assetSymbol.trim() : "";
      if (!sym) {
        return res
          .status(400)
          .json({ error: "assetSymbol is required for investment" });
      }
      if (typeof units !== "number" || Number.isNaN(units) || units === 0) {
        return res
          .status(400)
          .json({ error: "units must be a non-zero number for investment" });
      }
    }

    // Normalize tags
    const cleanTags = Array.isArray(tags)
      ? tags.filter((t) => typeof t === "string" && t.trim() !== "")
      : [];

    // Create
    const doc = await Transaction.create({
      userId: req.userId, // from requireAuth middleware
      accountId,
      categoryId: categoryId || null,
      type,
      amountMinor,
      currency,
      date: new Date(date), // ensure Date
      description: description || null,
      notes: notes || null,
      tags: cleanTags,
      assetSymbol: assetSymbol
        ? String(assetSymbol).toUpperCase().trim()
        : null,
      units: typeof units === "number" ? units : null,
      isDeleted: false,
    });

    return res.status(201).json(doc.toObject());
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** PUT/PATCH /transactions/:id */
export async function updateTransaction(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid transaction id" });
    }

    const {
      accountId,
      categoryId,
      type,
      amountMinor,
      currency,
      date,
      description,
      notes,
      tags,
      assetSymbol,
      units,
    } = req.body;

    const updates = {};

    // Optional ObjectId fields
    if (accountId !== undefined) {
      if (!mongoose.Types.ObjectId.isValid(accountId)) {
        return res.status(400).json({ error: "Invalid accountId" });
      }
      updates.accountId = accountId;
    }

    if (categoryId !== undefined) {
      if (categoryId !== null && !mongoose.Types.ObjectId.isValid(categoryId)) {
        return res.status(400).json({ error: "Invalid categoryId" });
      }
      updates.categoryId = categoryId === null ? null : categoryId;
    }

    // Optional enums / primitives
    if (type !== undefined) {
      const allowed = ["income", "expense", "transfer", "investment"];
      if (!allowed.includes(type)) {
        return res.status(400).json({ error: "Invalid type" });
      }
      updates.type = type;
    }

    if (amountMinor !== undefined) {
      if (typeof amountMinor !== "number" || Number.isNaN(amountMinor)) {
        return res.status(400).json({ error: "amountMinor must be a number" });
      }
      updates.amountMinor = amountMinor;
    }

    if (currency !== undefined) {
      if (typeof currency !== "string" || !currency.trim()) {
        return res.status(400).json({ error: "currency must be a string" });
      }
      updates.currency = currency.trim();
    }

    if (date !== undefined) {
      const d = new Date(date);
      if (Number.isNaN(d.getTime())) {
        return res.status(400).json({ error: "Invalid date" });
      }
      updates.date = d;
    }

    if (description !== undefined) {
      updates.description =
        typeof description === "string" && description.trim() !== ""
          ? description
          : null;
    }

    if (notes !== undefined) {
      updates.notes =
        typeof notes === "string" && notes.trim() !== "" ? notes : null;
    }

    if (tags !== undefined) {
      if (!Array.isArray(tags)) {
        return res
          .status(400)
          .json({ error: "tags must be an array of strings" });
      }
      const cleanTags = tags
        .filter((t) => typeof t === "string")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      updates.tags = cleanTags;
    }

    // NEW: allow updating assetSymbol & units
    if (assetSymbol !== undefined) {
      if (assetSymbol !== null && typeof assetSymbol !== "string") {
        return res
          .status(400)
          .json({ error: "assetSymbol must be a string or null" });
      }
      updates.assetSymbol =
        assetSymbol === null ? null : String(assetSymbol).toUpperCase().trim();
    }

    if (units !== undefined) {
      if (
        units !== null &&
        (typeof units !== "number" || Number.isNaN(units))
      ) {
        return res
          .status(400)
          .json({ error: "units must be a number or null" });
      }
      updates.units = units;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No updatable fields provided" });
    }

    // We may need to validate final state (type/category/asset fields)
    const needCurrentFetch =
      updates.type !== undefined ||
      updates.categoryId !== undefined ||
      updates.assetSymbol !== undefined ||
      updates.units !== undefined;

    if (needCurrentFetch) {
      const current = await Transaction.findOne({
        _id: id,
        userId: req.userId,
        isDeleted: { $ne: true },
      })
        .select("type categoryId assetSymbol units")
        .lean();

      if (!current) {
        return res.status(404).json({ error: "Transaction not found" });
      }

      const finalType = updates.type ?? current.type;
      const finalCategoryId =
        updates.categoryId === undefined
          ? current.categoryId
          : updates.categoryId;

      // Category.kind must match type for income/expense/investment
      if (finalCategoryId) {
        const cat = await Category.findOne({
          _id: finalCategoryId,
          userId: req.userId,
          isDeleted: { $ne: true },
        })
          .select("kind")
          .lean();

        if (!cat) {
          return res.status(400).json({ error: "Category not found" });
        }
        if (
          ["income", "expense", "investment"].includes(finalType) &&
          cat.kind !== finalType
        ) {
          return res.status(400).json({
            error: `Category kind (${cat.kind}) does not match transaction type (${finalType})`,
          });
        }
      }

      // Investment-specific sanity: if final type is investment, ensure symbol + non-zero units
      if (finalType === "investment") {
        const finalSymbol =
          updates.assetSymbol === undefined
            ? current.assetSymbol
            : updates.assetSymbol;
        const finalUnits =
          updates.units === undefined ? current.units : updates.units;

        if (!finalSymbol || !String(finalSymbol).trim()) {
          return res
            .status(400)
            .json({ error: "assetSymbol is required for investment" });
        }
        if (
          typeof finalUnits !== "number" ||
          Number.isNaN(finalUnits) ||
          finalUnits === 0
        ) {
          return res
            .status(400)
            .json({ error: "units must be a non-zero number for investment" });
        }
      }
    }

    // Perform update
    const updated = await Transaction.findOneAndUpdate(
      { _id: id, userId: req.userId, isDeleted: { $ne: true } },
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    return res.status(200).json(updated);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** DELETE /transactions/:id (soft) */
export async function softDeleteTransaction(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid transaction id" });
    }

    const updated = await Transaction.findOneAndUpdate(
      { _id: id, userId: req.userId, isDeleted: { $ne: true } },
      { $set: { isDeleted: true } },
      { new: true, lean: true }
    );

    if (!updated) {
      return res
        .status(404)
        .json({ error: "Transaction not found or already deleted" });
    }

    return res.status(200).json({ message: "Transaction soft-deleted", id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** DELETE /transactions/:id/hard */
export async function hardDeleteTransaction(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid transaction id" });
    }

    const result = await Transaction.deleteOne({ _id: id, userId: req.userId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    return res
      .status(200)
      .json({ message: "Transaction permanently deleted", id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
