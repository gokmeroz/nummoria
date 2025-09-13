import mongoose from "mongoose";
import { Account } from "../models/account.js";
// (Optional) If you want to hard-delete transactions too:
// import { Transaction } from "../models/transaction.js";

const { ObjectId } = mongoose.Types;

/** GET /accounts */
export async function getAccounts(req, res) {
  try {
    const accounts = await Account.find(
      { userId: req.userId, isDeleted: { $ne: true } },
      null,
      { lean: true }
    );

    // Return 200 with empty array if none (not 404)
    return res.status(200).json(accounts);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** GET /accounts/:id */
export async function getAccountById(req, res) {
  try {
    const { id } = req.params; // /:id from route
    if (!ObjectId.isValid(id))
      return res.status(400).json({ error: "Invalid account id" });

    const account = await Account.findOne(
      { _id: id, userId: req.userId, isDeleted: { $ne: true } },
      null,
      { lean: true }
    );
    if (!account) return res.status(404).json({ error: "Account not found" });

    return res.status(200).json(account);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** POST /accounts */
export async function createAccount(req, res) {
  try {
    const { name, currency, type, balance, institution, last4 } = req.body;
    if (!name || !currency) {
      return res.status(400).json({ error: "Name and currency are required" });
    }

    const doc = await Account.create({
      userId: req.userId,
      name,
      currency,
      type, // must exist in schema enum if you validate it
      balance, // ensure schema allows this (number, default 0)
      institution, // string? optional?
      last4, // string? length 4?
      isDeleted: false,
    });

    return res.status(201).json(doc);
  } catch (err) {
    // Typical validation errors show up here
    return res.status(500).json({ error: err.message });
  }
}

/** PUT/PATCH /accounts/:id */
export async function updateAccount(req, res) {
  try {
    const { id } = req.params; // /:id from route
    if (!ObjectId.isValid(id))
      return res.status(400).json({ error: "Invalid account id" });

    const updates = {};
    const whitelist = [
      "name",
      "currency",
      "type",
      "balance",
      "institution",
      "last4",
    ];
    for (const key of whitelist) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No updatable fields provided" });
    }

    const updated = await Account.findOneAndUpdate(
      { _id: id, userId: req.userId, isDeleted: { $ne: true } },
      { $set: updates },
      { new: true, runValidators: true, lean: true }
    );

    if (!updated) return res.status(404).json({ error: "Account not found" });
    return res.status(200).json(updated);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** DELETE /accounts/:id (soft) -> sets isDeleted: true */
export async function softDeleteAccount(req, res) {
  try {
    const { id } = req.params; // /:id from route
    if (!ObjectId.isValid(id))
      return res.status(400).json({ error: "Invalid account id" });

    const updated = await Account.findOneAndUpdate(
      { _id: id, userId: req.userId, isDeleted: { $ne: true } }, // only non-deleted
      { $set: { isDeleted: true } }, // soft delete
      { new: true, lean: true } // return updated doc
    );

    if (!updated)
      return res
        .status(404)
        .json({ error: "Account not found or already deleted" });
    return res.status(200).json({ message: "Account soft-deleted", id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/** DELETE /accounts/:id/hard (hard) -> permanently remove (and optionally cascade) */
export async function hardDeleteAccount(req, res) {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id))
      return res.status(400).json({ error: "Invalid account id" });

    // Optional: also delete related transactions
    // await Transaction.deleteMany({ userId: req.userId, accountId: id });

    const result = await Account.deleteOne({ _id: id, userId: req.userId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Account not found" });
    }
    return res.status(200).json({ message: "Account permanently deleted", id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
