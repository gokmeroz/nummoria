// backend/src/utils/transactionCreateCore.js
import mongoose from "mongoose";
import { Transaction } from "../models/transaction.js";
import { Category } from "../models/category.js";
import { Account } from "../models/account.js";
import {
  upsertTransactionReminderJob,
  removeTransactionReminderJob,
} from "../utils/reminders.js";

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
  // Accept undefined => no special meaning here; core expects reminder possibly undefined
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
  const enabled = Boolean(tx?.reminder?.enabled);
  const remindAt = tx?.reminder?.remindAt
    ? new Date(tx.reminder.remindAt)
    : null;

  if (!enabled || !remindAt || Number.isNaN(remindAt.getTime())) {
    await removeTransactionReminderJob(tx._id);
    return;
  }

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

/* -------------------------------------------------------------------------- */
/* NEW: Core creator used by manual and auto flows                             */
/* -------------------------------------------------------------------------- */
// Input: { userId, body } where body matches POST /transactions payload.
// Output: { createdCount, created } same as your controller.
export async function createTransactionCore({ userId, body }) {
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
  } = body || {};

  // Basic validation
  if (!accountId || !type || currency == null || date == null) {
    throw new Error("accountId, type, currency, and date are required");
  }
  if (!ObjectId.isValid(accountId)) {
    throw new Error("Invalid accountId");
  }
  if (categoryId && !ObjectId.isValid(categoryId)) {
    throw new Error("Invalid categoryId");
  }
  const allowedTypes = ["income", "expense", "transfer", "investment"];
  if (!allowedTypes.includes(type)) {
    throw new Error("Invalid type");
  }
  if (typeof amountMinor !== "number" || Number.isNaN(amountMinor)) {
    throw new Error("amountMinor must be a number");
  }

  // Category ↔ type consistency (if provided)
  let categoryDoc = null;
  if (categoryId) {
    categoryDoc = await Category.findOne({
      _id: categoryId,
      userId,
      isDeleted: { $ne: true },
    })
      .select("name kind")
      .lean();
    if (!categoryDoc) throw new Error("Category not found");
    if (
      ["income", "expense", "investment"].includes(type) &&
      categoryDoc.kind !== type
    ) {
      throw new Error(
        `Category kind (${categoryDoc.kind}) does not match transaction type (${type})`
      );
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
        throw new Error("assetSymbol is required for stock/crypto");
      }
      if (!(Number.isFinite(unitsNum) && unitsNum > 0)) {
        throw new Error("units must be > 0 for stock/crypto");
      }
    }
  }

  // Normalize
  const cleanTags = Array.isArray(tags)
    ? tags.filter((t) => typeof t === "string" && t.trim() !== "")
    : [];
  const cur = normalizeCurrency(currency);
  const when = startOfUTC(date);
  const rem = parseReminder(reminder);

  const reminderObj =
    rem && rem.enabled
      ? {
          enabled: true,
          offsetMinutes: rem.offsetMinutes,
          remindAt: computeRemindAtUTC(when, rem.offsetMinutes),
        }
      : {
          enabled: false,
          offsetMinutes: rem?.offsetMinutes ?? 1440,
          remindAt: null,
        };

  // Account and currency check
  const acct = await getAccountOrThrow({ accountId, userId });
  const acctCur = normalizeCurrency(acct.currency || "");
  if (acctCur !== cur) {
    throw new Error(
      `Currency mismatch: account is ${acctCur}, transaction is ${cur}. (FX not supported yet)`
    );
  }

  const baseDoc = {
    userId,
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
      typeof units === "number" && !Number.isNaN(units) ? Number(units) : null,
    reminder: reminderObj,
    isDeleted: false,
  };

  const created = [];

  // 1) Create the main row (affects balance if date <= today)
  const delta = shouldAffectBalance(when)
    ? deltaFor(type, baseDoc.amountMinor)
    : 0;

  try {
    if (delta !== 0) {
      await incBalanceOrThrow({ accountId, userId, delta });
    }
    const doc = await Transaction.create(baseDoc);
    created.push(doc.toObject());
    await applyReminderScheduling({ userId, tx: doc });
  } catch (e) {
    if (delta !== 0) {
      try {
        await incBalanceOrThrow({ accountId, userId, delta: -delta });
      } catch {}
    }
    throw e;
  }

  // 2) Optional future copy
  if (nextDate) {
    const plannedDate = startOfUTC(nextDate);

    const exists = await Transaction.exists({
      userId,
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
          await incBalanceOrThrow({ accountId, userId, delta: delta2 });
        }

        const copyReminder =
          rem && rem.enabled
            ? {
                enabled: true,
                offsetMinutes: rem.offsetMinutes,
                remindAt: computeRemindAtUTC(plannedDate, rem.offsetMinutes),
              }
            : {
                enabled: false,
                offsetMinutes: rem?.offsetMinutes ?? 1440,
                remindAt: null,
              };

        const copy = await Transaction.create({
          ...baseDoc,
          date: plannedDate,
          nextDate: undefined, // do not chain
          reminder: copyReminder,
        });
        created.push(copy.toObject());
        await applyReminderScheduling({ userId, tx: copy });
      } catch (e2) {
        if (delta2 !== 0) {
          try {
            await incBalanceOrThrow({ accountId, userId, delta: -delta2 });
          } catch {}
        }
        // ignore extra-copy failure
      }
    }
  }

  return { createdCount: created.length, created };
}
