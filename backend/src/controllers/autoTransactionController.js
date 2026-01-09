// backend/src/controllers/autoTransactionController.js
import mongoose from "mongoose";
import crypto from "crypto";
import { Transaction } from "../models/transaction.js";
import { TransactionDraft } from "../models/transactionDraft.js";
import { Account } from "../models/account.js";
import { Category } from "../models/category.js";
import { createTransactionCore } from "../utils/transactionCreateCore.js"; // NEW
import { TransactionDraft } from "../models/transactionDraft.js";

// We reuse a few behaviors from transactionController.js (same logic copied here)
// to avoid introducing a services folder.
function normalizeCurrency(cur) {
  return typeof cur === "string" ? cur.trim().toUpperCase() : cur;
}

function startOfUTC(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function parseReminder(reminder) {
  if (reminder === undefined) return undefined;

  const enabled = Boolean(reminder?.enabled);
  const offsetMinutesRaw = reminder?.offsetMinutes;

  const offsetMinutes =
    typeof offsetMinutesRaw === "number" &&
    Number.isFinite(offsetMinutesRaw) &&
    offsetMinutesRaw >= 0
      ? Math.floor(offsetMinutesRaw)
      : 1440;

  return { enabled, offsetMinutes };
}

async function getAccountOrThrow({ accountId, userId }) {
  const acct = await Account.findOne({
    _id: accountId,
    userId,
    isDeleted: { $ne: true },
  }).select("_id currency");
  if (!acct) throw new Error("Account not found");
  return acct;
}

// Small helper: escape regex special chars
function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// --------- TEXT PARSING (Phase 1: deterministic heuristics) ----------------

// Parses amount and currency from strings like:
// "280 try", "try 280", "€12.50", "$15", "15 usd"
function parseAmountCurrency(text) {
  const t = String(text || "").trim();

  // symbols
  const symbolMap = { "₺": "TRY", "€": "EUR", $: "USD", "£": "GBP" };

  // 1) Symbol-prefixed: "$12.34", "€12,34", "₺280"
  const symMatch = t.match(/([₺€$£])\s*([0-9]+([.,][0-9]{1,2})?)/);
  if (symMatch) {
    const cur = symbolMap[symMatch[1]];
    const num = Number(String(symMatch[2]).replace(",", "."));
    if (cur && Number.isFinite(num)) return { currency: cur, amount: num };
  }

  // 2) Code near number: "280 try", "280 TRY", "try 280"
  const codeMatch = t.match(
    /\b(try|usd|eur|gbp)\b[\s:]*([0-9]+([.,][0-9]{1,2})?)|\b([0-9]+([.,][0-9]{1,2})?)\b[\s:]*\b(try|usd|eur|gbp)\b/i
  );

  if (codeMatch) {
    const cur = normalizeCurrency(codeMatch[1] || codeMatch[6]);
    const numStr = codeMatch[2] || codeMatch[4];
    const num = Number(String(numStr).replace(",", "."));
    if (cur && Number.isFinite(num)) return { currency: cur, amount: num };
  }

  return { currency: null, amount: null };
}

function guessType(text) {
  const t = String(text || "").toLowerCase();

  // income keywords
  if (
    /\b(salary|payroll|income|paid me|got paid|bonus|refund|reimbursement)\b/.test(
      t
    )
  )
    return "income";

  // investment keywords
  if (
    /\b(buy|bought|sell|sold|invest|investment|stock|crypto|btc|eth)\b/.test(t)
  )
    return "investment";

  // expense keywords
  if (
    /\b(paid|spent|purchase|bought|coffee|uber|taxi|rent|bill|grocery|market)\b/.test(
      t
    )
  )
    return "expense";

  // default
  return "expense";
}

function extractDescription(text) {
  // very simple: remove amount/currency tokens and common verbs, keep remainder
  let t = String(text || "").trim();

  t = t.replace(/[₺€$£]/g, " ");
  t = t.replace(/\b(try|usd|eur|gbp)\b/gi, " ");
  t = t.replace(/\b[0-9]+([.,][0-9]{1,2})?\b/g, " ");

  t = t.replace(
    /\b(paid|spent|buy|bought|sell|sold|invest|income|salary|for|at|to|from)\b/gi,
    " "
  );

  t = t.replace(/\s+/g, " ").trim();
  return t || null;
}

// Lightweight category guess: tries to match Category.name by keyword
async function guessCategoryId({ userId, type, text }) {
  const q = String(text || "")
    .trim()
    .toLowerCase();
  if (!q) return null;

  // grab categories of that kind for user
  const cats = await Category.find({
    userId,
    isDeleted: { $ne: true },
    kind: type, // matches your transactionController consistency checks
  })
    .select("_id name")
    .lean();

  // naive keyword match: if category name appears in text
  for (const c of cats) {
    const name = String(c.name || "")
      .trim()
      .toLowerCase();
    if (!name) continue;
    const re = new RegExp(`\\b${escapeRegExp(name)}\\b`, "i");
    if (re.test(q)) return String(c._id);
  }

  return null;
}

function computeDedupeKey({ userId, type, amountMinor, currency, date, desc }) {
  const d = startOfUTC(date).toISOString().slice(0, 10);
  const merchant = String(desc || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 80);

  const base = `${userId}|${type}|${amountMinor}|${currency}|${d}|${merchant}`;
  return crypto.createHash("sha256").update(base).digest("hex");
}

async function findPossibleDuplicate({
  userId,
  type,
  amountMinor,
  currency,
  date,
  description,
}) {
  // window +/- 1 day
  const d0 = startOfUTC(date);
  const from = new Date(d0.getTime() - 24 * 60 * 60 * 1000);
  const to = new Date(d0.getTime() + 24 * 60 * 60 * 1000);

  return Transaction.findOne({
    userId,
    isDeleted: { $ne: true },
    type,
    amountMinor,
    currency,
    date: { $gte: from, $lte: to },
    description: description || null,
  })
    .select("_id")
    .lean();
}

// ------------------------------ POST TEXT ----------------------------------
// POST /auto/transactions/text
export async function autoCreateFromText(req, res) {
  try {
    const { accountId, text, type: typeOverride, date, reminder } = req.body;

    if (!accountId || !mongoose.Types.ObjectId.isValid(accountId)) {
      return res.status(400).json({ error: "Valid accountId is required" });
    }
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "text is required" });
    }

    const acct = await getAccountOrThrow({ accountId, userId: req.userId });

    const inferredType = typeOverride || guessType(text);
    const { currency: parsedCur, amount } = parseAmountCurrency(text);

    const reasons = [];
    let confidence = 0.0;

    // currency: prefer parsed, else account currency
    const cur = normalizeCurrency(parsedCur || acct.currency);
    if (!parsedCur) reasons.push("Currency inferred from account");

    // amount: required
    if (!(Number.isFinite(amount) && amount > 0)) {
      return res.status(400).json({
        error:
          "Could not detect amount. Example: 'paid 280 TRY coffee' or '$12 lunch'.",
      });
    }

    // date: default today
    const when = date ? startOfUTC(date) : startOfUTC(new Date());
    if (!date) reasons.push("Date defaulted to today");

    // description
    const description = extractDescription(text);
    if (!description) reasons.push("Description not confidently detected");

    // category guess (optional)
    const categoryId = await guessCategoryId({
      userId: req.userId,
      type: inferredType,
      text,
    });
    if (!categoryId) reasons.push("Category not confidently detected");

    // confidence scoring (simple + effective)
    confidence += 0.55; // base for having amount
    if (parsedCur) confidence += 0.1;
    if (description) confidence += 0.1;
    if (categoryId) confidence += 0.15;
    if (date) confidence += 0.1;
    confidence = Math.max(0, Math.min(1, confidence));

    // reminder (optional)
    const rem = parseReminder(reminder);
    const reminderObj =
      rem !== undefined
        ? { enabled: rem.enabled, offsetMinutes: rem.offsetMinutes }
        : { enabled: false, offsetMinutes: 1440 };

    const candidate = {
      accountId,
      categoryId: categoryId || null,
      type: inferredType,
      amountMinor: Math.round(amount * 100), // IMPORTANT: minor units assumption (2 decimals)
      currency: cur,
      date: when,
      description,
      notes: null,
      tags: [],
      reminder: reminderObj,
      // investment extras remain null for text phase 1
      assetSymbol: null,
      units: null,
    };

    // dedupe check
    const dupe = await findPossibleDuplicate({
      userId: req.userId,
      type: candidate.type,
      amountMinor: candidate.amountMinor,
      currency: candidate.currency,
      date: candidate.date,
      description: candidate.description,
    });

    if (dupe) {
      return res.status(200).json({
        mode: "duplicate",
        duplicateOf: String(dupe._id),
        candidate,
        confidence,
        reasons: ["Possible duplicate detected; not auto-created."],
      });
    }

    const dedupeKey = computeDedupeKey({
      userId: req.userId,
      type: candidate.type,
      amountMinor: candidate.amountMinor,
      currency: candidate.currency,
      date: candidate.date,
      desc: candidate.description,
    });

    // Gate: auto-post when high confidence; else draft
    const AUTO_POST_THRESHOLD = 0.85;

    if (confidence >= AUTO_POST_THRESHOLD) {
      // Post directly using Transaction.create through your existing endpoint logic is safer,
      // but we avoid duplicating all its validations by creating a draft and then posting via /transactions.
      // Here we will create via Transaction.create only if you accept the "amountMinor=100x" assumption.
      // Recommended: call your POST /transactions from frontend for final post, OR implement a shared helper.
      //
      // For now: create draft then post it immediately through the same code path as draft-post below.
      const draft = await TransactionDraft.create({
        userId: req.userId,
        accountId,
        source: "text",
        status: "draft",
        raw: { text },
        candidate,
        confidence,
        reasons,
        dedupeKey,
      });

      // Reuse draft post to ensure we go through the same checks as manual createTransaction
      req.params.id = String(draft._id);
      return await postDraft(req, res);
    }

    const draft = await TransactionDraft.create({
      userId: req.userId,
      accountId,
      source: "text",
      status: "draft",
      raw: { text },
      candidate,
      confidence,
      reasons,
      dedupeKey,
    });

    return res.status(201).json({ mode: "draft", draft });
  } catch (err) {
    return res.status(400).json({ error: err.message || "Auto parse failed" });
  }
}

// ------------------------------ GET DRAFTS ---------------------------------
// GET /auto/transactions/drafts?status=draft|posted|rejected
export async function getDrafts(req, res) {
  try {
    const status = req.query.status || "draft";
    const allowed = ["draft", "posted", "rejected"];
    const s = allowed.includes(status) ? status : "draft";

    const items = await TransactionDraft.find({
      userId: req.userId,
      status: s,
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json(items);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ----------------------------- PATCH DRAFT ---------------------------------
// PATCH /auto/transactions/drafts/:id
export async function updateDraft(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid draft id" });
    }

    const draft = await TransactionDraft.findOne({
      _id: id,
      userId: req.userId,
      status: "draft",
    });
    if (!draft) return res.status(404).json({ error: "Draft not found" });

    // Allow edits to candidate fields (restricted)
    const c = draft.candidate || {};
    const body = req.body || {};

    if (body.accountId !== undefined) {
      if (!mongoose.Types.ObjectId.isValid(body.accountId)) {
        return res.status(400).json({ error: "Invalid accountId" });
      }
      c.accountId = body.accountId;
      draft.accountId = body.accountId;
    }

    if (body.type !== undefined) {
      const allowed = ["income", "expense", "transfer", "investment"];
      if (!allowed.includes(body.type)) {
        return res.status(400).json({ error: "Invalid type" });
      }
      c.type = body.type;
    }

    if (body.categoryId !== undefined) {
      if (
        body.categoryId !== null &&
        !mongoose.Types.ObjectId.isValid(body.categoryId)
      ) {
        return res.status(400).json({ error: "Invalid categoryId" });
      }
      c.categoryId = body.categoryId;
    }

    if (body.amountMinor !== undefined) {
      if (
        typeof body.amountMinor !== "number" ||
        Number.isNaN(body.amountMinor)
      ) {
        return res.status(400).json({ error: "amountMinor must be a number" });
      }
      c.amountMinor = Math.abs(body.amountMinor);
    }

    if (body.currency !== undefined) {
      if (typeof body.currency !== "string" || !body.currency.trim()) {
        return res.status(400).json({ error: "currency must be a string" });
      }
      c.currency = normalizeCurrency(body.currency);
    }

    if (body.date !== undefined) {
      const d = new Date(body.date);
      if (Number.isNaN(d.getTime())) {
        return res.status(400).json({ error: "Invalid date" });
      }
      c.date = startOfUTC(d);
    }

    if (body.description !== undefined) {
      c.description =
        typeof body.description === "string" && body.description.trim()
          ? body.description
          : null;
    }

    if (body.notes !== undefined) {
      c.notes =
        typeof body.notes === "string" && body.notes.trim() ? body.notes : null;
    }

    if (body.tags !== undefined) {
      if (!Array.isArray(body.tags)) {
        return res.status(400).json({ error: "tags must be an array" });
      }
      c.tags = body.tags
        .filter((t) => typeof t === "string")
        .map((t) => t.trim())
        .filter(Boolean);
    }

    if (body.reminder !== undefined) {
      const rem = parseReminder(body.reminder);
      if (!rem) {
        c.reminder = { enabled: false, offsetMinutes: 1440 };
      } else {
        c.reminder = { enabled: rem.enabled, offsetMinutes: rem.offsetMinutes };
      }
    }

    // investment fields (optional)
    if (body.assetSymbol !== undefined) {
      c.assetSymbol =
        typeof body.assetSymbol === "string" && body.assetSymbol.trim()
          ? String(body.assetSymbol).toUpperCase().trim()
          : null;
    }
    if (body.units !== undefined) {
      if (
        body.units !== null &&
        (typeof body.units !== "number" || Number.isNaN(body.units))
      ) {
        return res
          .status(400)
          .json({ error: "units must be a number or null" });
      }
      c.units = body.units;
    }

    draft.candidate = c;
    await draft.save();

    return res.status(200).json(draft.toObject());
  } catch (err) {
    return res
      .status(400)
      .json({ error: err.message || "Update draft failed" });
  }
}

// ------------------------------ POST DRAFT ---------------------------------
// POST /auto/transactions/drafts/:id/post
export async function postDraft(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid draft id" });
    }

    const draft = await TransactionDraft.findOne({
      _id: id,
      userId: req.userId,
      status: "draft",
    });
    if (!draft) return res.status(404).json({ error: "Draft not found" });

    const candidate = draft.candidate;

    // NEW: Post using the same core as manual POST /transactions
    const result = await createTransactionCore({
      userId: req.userId,
      body: candidate,
    });

    // Mark draft posted (store first created tx id)
    const firstId = result?.created?.[0]?._id || null;

    draft.status = "posted";
    draft.postedTransactionId = firstId;
    await draft.save();

    return res.status(201).json({
      mode: "posted",
      createdCount: result.createdCount,
      created: result.created,
      draftId: String(draft._id),
    });
  } catch (err) {
    return res.status(400).json({ error: err.message || "Post draft failed" });
  }
}

// ------------------------------ REJECT DRAFT -------------------------------
// POST /auto/transactions/drafts/:id/reject
export async function rejectDraft(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid draft id" });
    }

    const reason =
      typeof req.body?.reason === "string" ? req.body.reason.trim() : null;

    const updated = await TransactionDraft.findOneAndUpdate(
      { _id: id, userId: req.userId, status: "draft" },
      { $set: { status: "rejected", rejectedReason: reason || null } },
      { new: true }
    ).lean();

    if (!updated) return res.status(404).json({ error: "Draft not found" });

    return res.status(200).json(updated);
  } catch (err) {
    return res
      .status(400)
      .json({ error: err.message || "Reject draft failed" });
  }
}
