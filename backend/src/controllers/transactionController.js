//backend/src/controllers/transactionController.js
import mongoose from "mongoose";
import { Transaction } from "../models/transaction.js";
import { Category } from "../models/category.js";
import { Account } from "../models/account.js";
import {
  upsertTransactionReminderJob,
  removeTransactionReminderJob,
} from "../utils/reminders.js";
import { createTransactionCore } from "../utils/transactionCreateCore.js"; // NEW

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

function parseReminder(reminder) {
  // Accept undefined => no change (for update)
  if (reminder === undefined) return undefined;

  const enabled = Boolean(reminder?.enabled);
  const offsetMinutesRaw = reminder?.offsetMinutes;

  const offsetMinutes =
    typeof offsetMinutesRaw === "number" &&
    Number.isFinite(offsetMinutesRaw) &&
    offsetMinutesRaw >= 0
      ? Math.floor(offsetMinutesRaw)
      : 1440; // default 1 day

  return { enabled, offsetMinutes };
}

function computeRemindAtUTC(txDateUTCStart, offsetMinutes) {
  // txDateUTCStart is already startOfUTC(date)
  return new Date(txDateUTCStart.getTime() - offsetMinutes * 60_000);
}

async function applyReminderScheduling({ userId, tx }) {
  // tx is a Transaction doc (or lean object) that includes reminder
  const enabled = Boolean(tx?.reminder?.enabled);
  const remindAt = tx?.reminder?.remindAt
    ? new Date(tx.reminder.remindAt)
    : null;

  // Always remove if disabled or invalid
  if (!enabled || !remindAt || Number.isNaN(remindAt.getTime())) {
    await removeTransactionReminderJob(tx._id);
    return;
  }

  // If remindAt already passed, don’t schedule
  if (remindAt.getTime() <= Date.now()) {
    await removeTransactionReminderJob(tx._id);
    return;
  }

  await upsertTransactionReminderJob({
    transactionId: tx._id,
    remindAt,
    payload: { userId, transactionId: String(tx._id) },
  });
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
// POST /transactions
export async function createTransaction(req, res) {
  try {
    // NEW: delegate to shared core (manual + auto)
    const result = await createTransactionCore({
      userId: req.userId,
      body: req.body,
    });
    return res.status(201).json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message || "Create failed" });
  }
}
/* --------------------------------- UPDATE --------------------------------- */
// PUT /transactions/:id
export async function updateTransaction(req, res) {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
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
      reminder,
    } = req.body;

    const next = { ...current };

    // --- apply incoming fields to `next` first ---
    if (accountId !== undefined) {
      if (!ObjectId.isValid(accountId)) {
        return res.status(400).json({ error: "Invalid accountId" });
      }
      next.accountId = accountId;
    }

    if (categoryId !== undefined) {
      if (categoryId !== null && !ObjectId.isValid(categoryId)) {
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

    // ✅ CRITICAL FIX: compute reminder AFTER date has been applied above
    const rem = parseReminder(reminder); // undefined means "no change"
    if (rem !== undefined) {
      if (rem.enabled) {
        const d = next.date ?? current.date;
        next.reminder = {
          enabled: true,
          offsetMinutes: rem.offsetMinutes,
          remindAt: computeRemindAtUTC(startOfUTC(d), rem.offsetMinutes),
        };
      } else {
        next.reminder = {
          enabled: false,
          offsetMinutes: rem.offsetMinutes,
          remindAt: null,
        };
      }
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

      const setDoc = {
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
      };

      // ✅ Only touch reminder fields if client sent `reminder`
      if (rem !== undefined) {
        setDoc["reminder.enabled"] = Boolean(next.reminder?.enabled);
        setDoc["reminder.offsetMinutes"] =
          typeof next.reminder?.offsetMinutes === "number"
            ? next.reminder.offsetMinutes
            : 1440;
        setDoc["reminder.remindAt"] = next.reminder?.remindAt ?? null;
      }

      const updated = await Transaction.findOneAndUpdate(
        { _id: id, userId: req.userId, isDeleted: { $ne: true } },
        { $set: setDoc },
        { new: true, runValidators: true }
      ).lean();

      if (!updated) {
        return res.status(404).json({ error: "Transaction not found" });
      }

      // ✅ Reschedule / remove job after successful update ONLY if reminder was in payload
      if (rem !== undefined) {
        await applyReminderScheduling({ userId: req.userId, tx: updated });
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
    if (!ObjectId.isValid(id)) {
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

      await removeTransactionReminderJob(tx._id);

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
    if (!ObjectId.isValid(id)) {
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

    await removeTransactionReminderJob(id);

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
