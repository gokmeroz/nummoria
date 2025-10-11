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

function startOfUTC(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// Only apply balance if the tx date is "today or earlier" (UTC)
function shouldAffectBalance(dateLike) {
  const tx = startOfUTC(dateLike);
  const today = startOfUTC(new Date());
  return tx.getTime() <= today.getTime();
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

// stock/crypto gate
function isStockOrCryptoCategory(catDoc) {
  if (!catDoc) return false;
  const n = String(catDoc.name || "")
    .trim()
    .toLowerCase();
  return n === "stock market" || n === "crypto currency exchange";
}

/* --------------------------------- GETs ----------------------------------- */
// GET /transactions?type=expense&accountId=...&categoryId=...&from=YYYY-MM-DD&to=YYYY-MM-DD&q=...
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

    // Date range (UTC)
    const and = [];
    if (req.query.from) {
      and.push({ date: { $gte: startOfUTC(req.query.from) } });
    }
    if (req.query.to) {
      and.push({ date: { $lte: startOfUTC(req.query.to) } });
    }
    if (and.length) filter.$and = and;

    // Simple text search (desc/notes/tags)
    const q = (req.query.q || "").trim();
    if (q) {
      const like = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { description: like },
        { notes: like },
        { tags: { $in: [like] } },
      ];
    }

    const txs = await Transaction.find(filter).lean();
    return res.status(200).json(txs);
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

    const tx = await Transaction.findOne({
      _id: id,
      userId: req.userId,
      isDeleted: { $ne: true },
    }).lean();

    if (!tx) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    return res.status(200).json(tx);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/* --------------------------------- CREATE --------------------------------- */
// POST /transactions
// Body supports optional nextDate: if provided, we will also create a COPY
// at that date (future), and only affect balances for rows whose date <= today.
export async function createTransaction(req, res) {
  try {
    const {
      accountId,
      categoryId,
      type,
      amountMinor,
      currency,
      date,
      nextDate,
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
    let categoryDoc = null;
    if (categoryId) {
      categoryDoc = await Category.findOne({
        _id: categoryId,
        userId: req.userId,
        isDeleted: { $ne: true },
      })
        .select("name kind")
        .lean();
      if (!categoryDoc)
        return res.status(400).json({ error: "Category not found" });
      if (
        ["income", "expense", "investment"].includes(type) &&
        categoryDoc.kind !== type
      ) {
        return res.status(400).json({
          error: `Category kind (${categoryDoc.kind}) does not match transaction type (${type})`,
        });
      }
    }

    // Investment-specific validation (conditional)
    if (type === "investment") {
      const requiresSymbolUnits = isStockOrCryptoCategory(categoryDoc);
      const sym = typeof assetSymbol === "string" ? assetSymbol.trim() : "";
      const unitsNum =
        typeof units === "number" && !Number.isNaN(units) ? units : null;

      if (requiresSymbolUnits) {
        if (!sym) {
          return res
            .status(400)
            .json({ error: "assetSymbol is required for stock/crypto" });
        }
        if (!(Number.isFinite(unitsNum) && unitsNum > 0)) {
          return res
            .status(400)
            .json({ error: "units must be > 0 for stock/crypto" });
        }
      }
    }

    // Normalize
    const cleanTags = Array.isArray(tags)
      ? tags.filter((t) => typeof t === "string" && t.trim() !== "")
      : [];
    const cur = normalizeCurrency(currency);
    const when = startOfUTC(date);

    // Account and currency check
    const acct = await getAccountOrThrow({ accountId, userId: req.userId });
    const acctCur = normalizeCurrency(acct.currency || "");
    if (acctCur !== cur) {
      return res.status(400).json({
        error: `Currency mismatch: account is ${acctCur}, transaction is ${cur}. (FX not supported yet)`,
      });
    }

    const baseDoc = {
      userId: req.userId,
      accountId,
      categoryId: categoryId || null,
      type,
      amountMinor: Math.abs(amountMinor),
      currency: cur,
      date: when,
      nextDate: nextDate ? startOfUTC(nextDate) : undefined, // metadata only
      description: description || null,
      notes: notes || null,
      tags: cleanTags,
      assetSymbol:
        typeof assetSymbol === "string" && assetSymbol.trim()
          ? String(assetSymbol).toUpperCase().trim()
          : null,
      units:
        typeof units === "number" && !Number.isNaN(units)
          ? Number(units)
          : null,
      isDeleted: false,
    };

    const created = [];

    // 1) Create the main row (affects balance if date <= today)
    const delta = shouldAffectBalance(when)
      ? deltaFor(type, baseDoc.amountMinor)
      : 0;
    try {
      if (delta !== 0) {
        await incBalanceOrThrow({ accountId, userId: req.userId, delta });
      }
      const doc = await Transaction.create(baseDoc);
      created.push(doc.toObject());
    } catch (e) {
      if (delta !== 0) {
        try {
          await incBalanceOrThrow({
            accountId,
            userId: req.userId,
            delta: -delta,
          });
        } catch {}
      }
      throw e;
    }

    // 2) Optional future copy
    if (nextDate) {
      const plannedDate = startOfUTC(nextDate);

      const exists = await Transaction.exists({
        userId: req.userId,
        isDeleted: { $ne: true },
        accountId,
        categoryId: categoryId || null,
        type,
        amountMinor: Math.abs(amountMinor),
        currency: cur,
        date: plannedDate,
        description: description || null,
      });

      if (!exists) {
        const delta2 = shouldAffectBalance(plannedDate)
          ? deltaFor(type, Math.abs(amountMinor))
          : 0;

        try {
          if (delta2 !== 0) {
            await incBalanceOrThrow({
              accountId,
              userId: req.userId,
              delta: delta2,
            });
          }
          const copy = await Transaction.create({
            ...baseDoc,
            date: plannedDate,
            nextDate: undefined, // do not chain
          });
          created.push(copy.toObject());
        } catch (e2) {
          if (delta2 !== 0) {
            try {
              await incBalanceOrThrow({
                accountId,
                userId: req.userId,
                delta: -delta2,
              });
            } catch {}
          }
          // ignore extra-copy failure
        }
      }
    }

    return res.status(201).json({ createdCount: created.length, created });
  } catch (err) {
    return res.status(400).json({ error: err.message || "Create failed" });
  }
}

/* --------------------------------- UPDATE --------------------------------- */
// PUT /transactions/:id
export async function updateTransaction(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid transaction id" });
    }

    const current = await Transaction.findOne({
      _id: id,
      userId: req.userId,
      isDeleted: { $ne: true },
    }).lean();
    if (!current)
      return res.status(404).json({ error: "Transaction not found" });

    const {
      accountId,
      categoryId,
      type,
      amountMinor,
      currency,
      date,
      nextDate,
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
      next.date = startOfUTC(d);
    }

    if (nextDate !== undefined) {
      if (nextDate === null || nextDate === "") {
        next.nextDate = undefined;
      } else {
        const d = new Date(nextDate);
        if (Number.isNaN(d.getTime())) {
          return res.status(400).json({ error: "Invalid nextDate" });
        }
        next.nextDate = startOfUTC(d);
      }
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
    let categoryDoc = null;
    if (next.categoryId) {
      categoryDoc = await Category.findOne({
        _id: next.categoryId,
        userId: req.userId,
        isDeleted: { $ne: true },
      })
        .select("name kind")
        .lean();
      if (!categoryDoc)
        return res.status(400).json({ error: "Category not found" });
      if (
        ["income", "expense", "investment"].includes(next.type) &&
        categoryDoc.kind !== next.type
      ) {
        return res.status(400).json({
          error: `Category kind (${categoryDoc.kind}) does not match transaction type (${next.type})`,
        });
      }
    }

    // Conditional investment constraints on UPDATE
    if (next.type === "investment") {
      const stockOrCrypto = isStockOrCryptoCategory(categoryDoc);
      const sym =
        next.assetSymbol != null ? String(next.assetSymbol).trim() : null;
      const unitsNum =
        next.units != null && !Number.isNaN(Number(next.units))
          ? Number(next.units)
          : null;

      if (stockOrCrypto) {
        if (!sym) {
          return res
            .status(400)
            .json({ error: "assetSymbol is required for stock/crypto" });
        }
        if (!(Number.isFinite(unitsNum) && unitsNum > 0)) {
          return res
            .status(400)
            .json({ error: "units must be > 0 for stock/crypto" });
        }
      } else {
        // make sure non-stock categories can clear these fields
        if (sym === "") next.assetSymbol = null;
        if (next.units === "" || next.units === undefined) next.units = null;
      }
    }

    // Account & currency integrity checks
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

    // Balance math with posting boundary (date <= today)
    const oldPosted = shouldAffectBalance(current.date);
    const newPosted = shouldAffectBalance(next.date ?? current.date);

    const oldDelta = oldPosted
      ? deltaFor(current.type, current.amountMinor)
      : 0;
    const newDelta = newPosted ? deltaFor(next.type, next.amountMinor) : 0;

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
        // revert old, then apply new
        if (oldDelta !== 0) {
          await incBalanceOrThrow({
            accountId: oldAcct._id,
            userId: req.userId,
            delta: -oldDelta,
          });
        }
        try {
          if (newDelta !== 0) {
            await incBalanceOrThrow({
              accountId: newAcct._id,
              userId: req.userId,
              delta: newDelta,
            });
          }
        } catch (e2) {
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
            nextDate: next.nextDate ?? undefined,
            description: next.description ?? null,
            notes: next.notes ?? null,
            tags: next.tags ?? [],
            assetSymbol: next.assetSymbol ?? null,
            units: next.units ?? null,
          },
        },
        { new: true, runValidators: true }
      ).lean();

      if (!updated)
        return res.status(404).json({ error: "Transaction not found" });
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
      .select("_id accountId type amountMinor currency date")
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

    const posted = shouldAffectBalance(tx.date);
    const revert = posted ? -deltaFor(tx.type, tx.amountMinor) : 0;

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
      .select("_id accountId type amountMinor currency date isDeleted")
      .lean();

    if (!tx) return res.status(404).json({ error: "Transaction not found" });

    // Only revert if it wasn't soft-deleted and was posted
    if (tx.isDeleted !== true && shouldAffectBalance(tx.date)) {
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
