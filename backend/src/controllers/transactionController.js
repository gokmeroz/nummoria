// backend/src/controllers/transactionController.js
import mongoose from "mongoose";
import { Transaction } from "../models/transaction.js";
import { Category } from "../models/category.js";
import { Account } from "../models/account.js";

const { ObjectId } = mongoose.Types;

/* ------------------------------ Helpers ----------------------------------- */
function normalizeCurrency(cur) {
  return typeof cur === "string" ? cur.trim().toUpperCase() : cur;
}

function deltaFor(type, amountMinor) {
  const abs = Math.abs(Number(amountMinor) || 0);
  switch (type) {
    case "income":
      return +abs; // inflow
    case "expense":
    case "investment":
      return -abs; // outflow
    case "transfer":
      throw new Error("Transfer handling not implemented on this endpoint");
    default:
      throw new Error("Unsupported type");
  }
}

async function getAccountOrThrow({ accountId, userId }) {
  const acct = await Account.findOne({
    _id: accountId,
    userId,
    isDeleted: { $ne: true },
  }).select("_id currency balance");
  if (!acct) throw new Error("Account not found");
  return acct;
}

async function incBalanceOrThrow({ accountId, userId, delta }) {
  const res = await Account.updateOne(
    { _id: accountId, userId, isDeleted: { $ne: true } },
    { $inc: { balance: delta } }
  );
  if (res.matchedCount === 0) throw new Error("Account not found");
}

/* --------------------------------- GETs ----------------------------------- */
export async function getTransactions(req, res) {
  try {
    const filter = { userId: req.userId, isDeleted: { $ne: true } };

    if (req.query.type) {
      const allowed = ["income", "expense", "transfer", "investment"];
      if (allowed.includes(req.query.type)) filter.type = req.query.type;
    }
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

/* --------------------------------- CREATE --------------------------------- */
export async function createTransaction(req, res) {
  try {
    const {
      accountId,
      categoryId, // optional for investment
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

    // Basic validation
    if (!accountId || !type || currency == null || date == null) {
      return res
        .status(400)
        .json({ error: "accountId, type, currency, and date are required" });
    }
    if (!mongoose.Types.ObjectId.isValid(accountId)) {
      return res.status(400).json({ error: "Invalid accountId" });
    }
    if (categoryId && !mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({ error: "Invalid categoryId" });
    }
    const allowedTypes = ["income", "expense", "transfer", "investment"];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ error: "Invalid type" });
    }
    if (typeof amountMinor !== "number" || Number.isNaN(amountMinor)) {
      return res.status(400).json({ error: "amountMinor must be a number" });
    }

    // Category ↔ type consistency (if provided)
    if (categoryId) {
      const cat = await Category.findOne({
        _id: categoryId,
        userId: req.userId,
        isDeleted: { $ne: true },
      })
        .select("kind")
        .lean();
      if (!cat) return res.status(400).json({ error: "Category not found" });
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

    // Normalize
    const cleanTags = Array.isArray(tags)
      ? tags.filter((t) => typeof t === "string" && t.trim() !== "")
      : [];
    const cur = normalizeCurrency(currency);
    const when = new Date(date);

    // Load account and verify currency
    const acct = await getAccountOrThrow({ accountId, userId: req.userId });
    const acctCur = normalizeCurrency(acct.currency || "");
    if (acctCur !== cur) {
      return res.status(400).json({
        error: `Currency mismatch: account is ${acctCur}, transaction is ${cur}. (FX not supported yet)`,
      });
    }

    // Compute delta; apply balance first, then create doc. Roll back if doc create fails.
    const abs = Math.abs(amountMinor);
    const delta = deltaFor(type, abs);

    try {
      if (delta !== 0) {
        await incBalanceOrThrow({ accountId, userId: req.userId, delta });
      }

      const doc = await Transaction.create({
        userId: req.userId,
        accountId,
        categoryId: categoryId || null,
        type,
        amountMinor: abs, // store positive
        currency: cur,
        date: when,
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
    } catch (innerErr) {
      // rollback balance if tx create failed
      if (delta !== 0) {
        try {
          await incBalanceOrThrow({
            accountId,
            userId: req.userId,
            delta: -delta,
          });
        } catch {
          // swallow rollback error to not mask the original error
        }
      }
      throw innerErr;
    }
  } catch (err) {
    return res.status(400).json({ error: err.message || "Create failed" });
  }
}

/* --------------------------------- UPDATE --------------------------------- */
export async function updateTransaction(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid transaction id" });
    }

    // Load current tx (must exist and not deleted)
    const current = await Transaction.findOne({
      _id: id,
      userId: req.userId,
      isDeleted: { $ne: true },
    }).lean();
    if (!current) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    // Build next state from inputs
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

    const next = { ...current };

    if (accountId !== undefined) {
      if (!mongoose.Types.ObjectId.isValid(accountId)) {
        return res.status(400).json({ error: "Invalid accountId" });
      }
      next.accountId = accountId;
    }

    if (categoryId !== undefined) {
      if (categoryId !== null && !mongoose.Types.ObjectId.isValid(categoryId)) {
        return res.status(400).json({ error: "Invalid categoryId" });
      }
      next.categoryId = categoryId === null ? null : categoryId;
    }

    if (type !== undefined) {
      const allowed = ["income", "expense", "transfer", "investment"];
      if (!allowed.includes(type)) {
        return res.status(400).json({ error: "Invalid type" });
      }
      next.type = type;
    }

    if (amountMinor !== undefined) {
      if (typeof amountMinor !== "number" || Number.isNaN(amountMinor)) {
        return res.status(400).json({ error: "amountMinor must be a number" });
      }
      next.amountMinor = Math.abs(amountMinor);
    }

    if (currency !== undefined) {
      if (typeof currency !== "string" || !currency.trim()) {
        return res.status(400).json({ error: "currency must be a string" });
      }
      next.currency = normalizeCurrency(currency);
    }

    if (date !== undefined) {
      const d = new Date(date);
      if (Number.isNaN(d.getTime())) {
        return res.status(400).json({ error: "Invalid date" });
      }
      next.date = d;
    }

    if (description !== undefined) {
      next.description =
        typeof description === "string" && description.trim() !== ""
          ? description
          : null;
    }

    if (notes !== undefined) {
      next.notes =
        typeof notes === "string" && notes.trim() !== "" ? notes : null;
    }

    if (tags !== undefined) {
      if (!Array.isArray(tags)) {
        return res
          .status(400)
          .json({ error: "tags must be an array of strings" });
      }
      next.tags = tags
        .filter((t) => typeof t === "string")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
    }

    if (assetSymbol !== undefined) {
      if (assetSymbol !== null && typeof assetSymbol !== "string") {
        return res
          .status(400)
          .json({ error: "assetSymbol must be a string or null" });
      }
      next.assetSymbol =
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
      next.units = units;
    }

    // Category ↔ type check (if category present)
    if (next.categoryId) {
      const cat = await Category.findOne({
        _id: next.categoryId,
        userId: req.userId,
        isDeleted: { $ne: true },
      })
        .select("kind")
        .lean();
      if (!cat) return res.status(400).json({ error: "Category not found" });
      if (
        ["income", "expense", "investment"].includes(next.type) &&
        cat.kind !== next.type
      ) {
        return res.status(400).json({
          error: `Category kind (${cat.kind}) does not match transaction type (${next.type})`,
        });
      }
    }

    // Investment sanity
    if (next.type === "investment") {
      if (!next.assetSymbol || !String(next.assetSymbol).trim()) {
        return res
          .status(400)
          .json({ error: "assetSymbol is required for investment" });
      }
      if (
        typeof next.units !== "number" ||
        Number.isNaN(next.units) ||
        next.units === 0
      ) {
        return res
          .status(400)
          .json({ error: "units must be a non-zero number for investment" });
      }
    }

    // Defaults if not provided
    next.currency = normalizeCurrency(next.currency || current.currency);
    next.amountMinor =
      typeof next.amountMinor === "number"
        ? Math.abs(next.amountMinor)
        : Math.abs(current.amountMinor);

    // Load accounts and validate currencies
    const oldAcct = await getAccountOrThrow({
      accountId: current.accountId,
      userId: req.userId,
    });
    const newAcct = await getAccountOrThrow({
      accountId: next.accountId,
      userId: req.userId,
    });

    const oldCur = normalizeCurrency(oldAcct.currency || "");
    const newCur = normalizeCurrency(newAcct.currency || "");
    if (oldCur !== normalizeCurrency(current.currency || "")) {
      return res.status(400).json({
        error: `Data integrity: stored tx currency ${current.currency} != account currency ${oldCur}`,
      });
    }
    if (newCur !== next.currency) {
      return res.status(400).json({
        error: `Currency mismatch: account is ${newCur}, transaction is ${next.currency}. (FX not supported yet)`,
      });
    }

    // Compute balance deltas
    const oldDelta = deltaFor(current.type, current.amountMinor);
    const newDelta = deltaFor(next.type, next.amountMinor);

    // Apply balance changes with manual rollback if something fails
    const sameAccount = String(oldAcct._id) === String(newAcct._id);
    try {
      if (sameAccount) {
        const net = newDelta - oldDelta;
        if (net !== 0) {
          await incBalanceOrThrow({
            accountId: oldAcct._id,
            userId: req.userId,
            delta: net,
          });
        }
      } else {
        if (oldDelta !== 0) {
          await incBalanceOrThrow({
            accountId: oldAcct._id,
            userId: req.userId,
            delta: -oldDelta, // revert old
          });
        }
        try {
          if (newDelta !== 0) {
            await incBalanceOrThrow({
              accountId: newAcct._id,
              userId: req.userId,
              delta: newDelta, // apply new
            });
          }
        } catch (e2) {
          // rollback old revert
          if (oldDelta !== 0) {
            try {
              await incBalanceOrThrow({
                accountId: oldAcct._id,
                userId: req.userId,
                delta: +oldDelta,
              });
            } catch {}
          }
          throw e2;
        }
      }

      // Persist the transaction changes
      const updated = await Transaction.findOneAndUpdate(
        { _id: id, userId: req.userId, isDeleted: { $ne: true } },
        {
          $set: {
            accountId: next.accountId,
            categoryId: next.categoryId ?? null,
            type: next.type,
            amountMinor: Math.abs(next.amountMinor),
            currency: next.currency,
            date: next.date ?? current.date,
            description: next.description ?? null,
            notes: next.notes ?? null,
            tags: next.tags ?? [],
            assetSymbol: next.assetSymbol ?? null,
            units: next.units ?? null,
          },
        },
        { new: true, runValidators: true }
      ).lean();

      if (!updated) {
        // rollback balances if doc update somehow failed
        if (sameAccount) {
          const net = newDelta - oldDelta;
          if (net !== 0) {
            try {
              await incBalanceOrThrow({
                accountId: oldAcct._id,
                userId: req.userId,
                delta: -net,
              });
            } catch {}
          }
        } else {
          // rollback both sides
          if (newDelta !== 0) {
            try {
              await incBalanceOrThrow({
                accountId: newAcct._id,
                userId: req.userId,
                delta: -newDelta,
              });
            } catch {}
          }
          if (oldDelta !== 0) {
            try {
              await incBalanceOrThrow({
                accountId: oldAcct._id,
                userId: req.userId,
                delta: +oldDelta,
              });
            } catch {}
          }
        }
        return res.status(404).json({ error: "Transaction not found" });
      }

      return res.status(200).json(updated);
    } catch (errApply) {
      return res
        .status(400)
        .json({ error: errApply.message || "Update failed" });
    }
  } catch (err) {
    return res.status(400).json({ error: err.message || "Update failed" });
  }
}

/* --------------------------------- DELETE --------------------------------- */
export async function softDeleteTransaction(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid transaction id" });
    }

    const tx = await Transaction.findOne({
      _id: id,
      userId: req.userId,
      isDeleted: { $ne: true },
    })
      .select("_id accountId type amountMinor currency")
      .lean();

    if (!tx) {
      return res
        .status(404)
        .json({ error: "Transaction not found or already deleted" });
    }

    const acct = await getAccountOrThrow({
      accountId: tx.accountId,
      userId: req.userId,
    });

    const acctCur = normalizeCurrency(acct.currency || "");
    const txCur = normalizeCurrency(tx.currency || "");
    if (acctCur !== txCur) {
      return res.status(400).json({
        error: `Currency mismatch: account is ${acctCur}, transaction is ${txCur}`,
      });
    }

    const revert = -deltaFor(tx.type, tx.amountMinor);

    try {
      if (revert !== 0) {
        await incBalanceOrThrow({
          accountId: acct._id,
          userId: req.userId,
          delta: revert,
        });
      }
      await Transaction.updateOne(
        { _id: tx._id },
        { $set: { isDeleted: true } }
      );
      return res.status(200).json({ message: "Transaction soft-deleted", id });
    } catch (applyErr) {
      // rollback balance if marking as deleted failed
      if (revert !== 0) {
        try {
          await incBalanceOrThrow({
            accountId: acct._id,
            userId: req.userId,
            delta: -revert,
          });
        } catch {}
      }
      return res
        .status(400)
        .json({ error: applyErr.message || "Delete failed" });
    }
  } catch (err) {
    return res.status(400).json({ error: err.message || "Delete failed" });
  }
}

export async function hardDeleteTransaction(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid transaction id" });
    }

    const tx = await Transaction.findOne({
      _id: id,
      userId: req.userId,
    })
      .select("_id accountId type amountMinor currency isDeleted")
      .lean();

    if (!tx) return res.status(404).json({ error: "Transaction not found" });

    // Only revert if it wasn't soft-deleted already
    if (tx.isDeleted !== true) {
      const acct = await getAccountOrThrow({
        accountId: tx.accountId,
        userId: req.userId,
      });
      const acctCur = normalizeCurrency(acct.currency || "");
      const txCur = normalizeCurrency(tx.currency || "");
      if (acctCur !== txCur) {
        return res.status(400).json({
          error: `Currency mismatch: account is ${acctCur}, transaction is ${txCur}`,
        });
      }
      const revert = -deltaFor(tx.type, tx.amountMinor);
      if (revert !== 0) {
        try {
          await incBalanceOrThrow({
            accountId: acct._id,
            userId: req.userId,
            delta: revert,
          });
        } catch (e) {
          return res
            .status(400)
            .json({ error: e.message || "Balance revert failed" });
        }
      }
    }

    const result = await Transaction.deleteOne({ _id: id, userId: req.userId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Transaction not found" });
    }
    return res
      .status(200)
      .json({ message: "Transaction permanently deleted", id });
  } catch (err) {
    return res.status(400).json({ error: err.message || "Hard delete failed" });
  }
}
