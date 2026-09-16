// backend/src/ai/confidence.js
//
// Frozen confidence representation for extracted transactions (see
// docs/ai-roadmap/SCHEMA.md). Two independent scoring paths feed the same
// shape:
//
//   - scoreParserSelf(): no model call. Used by the deterministic regex tier
//     in pdfParser.js to decide whether a document needs to escalate at all.
//   - scoreAgreement(): compares a parser-tier guess against a model-tier
//     guess for the same transaction, after normalizing both. Only exists
//     for documents that already escalated.
//
// A ConfidenceEntry is { value: 0..1, source, reasons: string[] }.
// A transaction's confidence is { overall, fields: Record<field, Entry> },
// where overall = min(...fields) — the weakest field gates trust in the
// whole row, mirroring the existing auto-post gate in
// autoTransactionController.js (which scores a *different* input, SMS text,
// with its own rule-based scalar — that one is untouched by this module).

export const CONFIDENCE_SOURCES = Object.freeze({
  RULE: "rule", // autoTransactionController's field-presence heuristic
  PARSER_SELF: "parser-self", // deterministic tier, pre-escalation
  AGREEMENT: "agreement", // parser vs. model, matched pair
  MODEL_ONLY: "model-only", // model found it, parser had nothing to compare
});

function entry(value, source, reasons = []) {
  return { value: Math.max(0, Math.min(1, value)), source, reasons };
}

function overallOf(fields) {
  const values = Object.values(fields).map((f) => f.value);
  return values.length ? Math.min(...values) : 0;
}

/**
 * Parser-self confidence for one regex-parsed transaction. No model call —
 * this is what the cascade's escalation gate reads.
 *
 * @param {{dateMatch: RegExpMatchArray|null, amountMatch: RegExpMatchArray|null,
 *   description: string, category: string, multiline: boolean}} ctx
 */
export function scoreParserSelf(ctx) {
  const fields = {};

  // date: a 4-digit year and an unambiguous day/month (one side > 12) means
  // the format couldn't have been guessed wrong; both <=12 means we assumed
  // an order (e.g. MM/DD vs DD/MM) without real evidence.
  if (ctx.dateMatch) {
    const raw = ctx.dateMatch[1];
    const parts = raw.split(/[\/\.\-]/).map(Number);
    const hasFourDigitYear = /\d{4}/.test(raw);
    const unambiguous = parts.length >= 2 && (parts[0] > 12 || parts[1] > 12);
    if (hasFourDigitYear && unambiguous) {
      fields.date = entry(0.9, CONFIDENCE_SOURCES.PARSER_SELF, [
        "4-digit year, day/month order unambiguous",
      ]);
    } else if (hasFourDigitYear) {
      fields.date = entry(0.6, CONFIDENCE_SOURCES.PARSER_SELF, [
        "4-digit year, but day/month order assumed",
      ]);
    } else {
      fields.date = entry(0.4, CONFIDENCE_SOURCES.PARSER_SELF, [
        "2-digit year inferred as 2000+YY",
      ]);
    }
  } else {
    fields.date = entry(0.2, CONFIDENCE_SOURCES.PARSER_SELF, ["no date match"]);
  }

  // amount: a decimal marker present means the parser isn't guessing where
  // the fraction boundary is.
  if (ctx.amountMatch) {
    const raw = ctx.amountMatch[1];
    const hasDecimal = /[.,]\d{2}\b/.test(raw);
    fields.amount = hasDecimal
      ? entry(0.9, CONFIDENCE_SOURCES.PARSER_SELF, ["decimal marker present"])
      : entry(0.6, CONFIDENCE_SOURCES.PARSER_SELF, [
          "integer-only amount, no decimal marker",
        ]);
  } else {
    fields.amount = entry(0.2, CONFIDENCE_SOURCES.PARSER_SELF, [
      "no amount match",
    ]);
  }

  // description: non-trivial leftover text after stripping date/amount.
  const desc = (ctx.description || "").trim();
  fields.description =
    desc.length >= 3 && desc.length <= 120
      ? entry(0.8, CONFIDENCE_SOURCES.PARSER_SELF, ["plausible length"])
      : entry(0.35, CONFIDENCE_SOURCES.PARSER_SELF, [
          desc.length ? "unusually short/long" : "empty after stripping",
        ]);

  // category: only trust it if a known dictionary pattern actually fired —
  // "Other" is a default, not a detection.
  fields.category =
    ctx.category && ctx.category !== "Other"
      ? entry(0.75, CONFIDENCE_SOURCES.PARSER_SELF, ["dictionary match"])
      : entry(0.35, CONFIDENCE_SOURCES.PARSER_SELF, ["defaulted to Other"]);

  let overall = overallOf(fields);
  if (ctx.multiline) {
    // Date/amount/description spread across separate lines is a weaker
    // association than all three on one line — cap regardless of per-field
    // scores.
    overall = Math.min(overall, 0.7);
  }

  return { overall, fields };
}

function normalizeForCompare(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function tokenOverlap(a, b) {
  const ta = new Set(normalizeForCompare(a).split(" ").filter(Boolean));
  const tb = new Set(normalizeForCompare(b).split(" ").filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / Math.max(ta.size, tb.size);
}

/**
 * Agreement confidence for a (parser guess, model guess) pair that were
 * matched as "the same transaction" (same normalized date + amount).
 * Only date/amount decided the match, so they always score as agreeing;
 * description is the interesting comparison.
 */
export function scoreAgreement(parserTx, modelTx) {
  const fields = {
    date: entry(0.95, CONFIDENCE_SOURCES.AGREEMENT, [
      "parser and model independently produced the same date",
    ]),
    amount: entry(0.95, CONFIDENCE_SOURCES.AGREEMENT, [
      "parser and model independently produced the same amount",
    ]),
  };

  const overlap = tokenOverlap(parserTx.description, modelTx.description);
  fields.description =
    overlap >= 0.5
      ? entry(0.85, CONFIDENCE_SOURCES.AGREEMENT, [
          `description token overlap ${overlap.toFixed(2)}`,
        ])
      : entry(0.5, CONFIDENCE_SOURCES.AGREEMENT, [
          `description token overlap ${overlap.toFixed(2)} — parser and model disagree on wording`,
        ]);

  // Category is parser-only (the model tier doesn't independently
  // categorize in this pipeline — see pdfParser.js), so it keeps whatever
  // parser-self score it already had rather than being re-scored here.
  if (parserTx.confidence?.fields?.category) {
    fields.category = parserTx.confidence.fields.category;
  }

  return { overall: overallOf(fields), fields };
}

/**
 * Confidence for a transaction the model found with no parser counterpart
 * at all. There's nothing to cross-check against, so this is capped at a
 * fixed moderate value rather than claiming real confidence.
 */
export function scoreModelOnly() {
  const fields = {
    date: entry(0.6, CONFIDENCE_SOURCES.MODEL_ONLY, ["unverified by parser"]),
    amount: entry(0.6, CONFIDENCE_SOURCES.MODEL_ONLY, ["unverified by parser"]),
    description: entry(0.6, CONFIDENCE_SOURCES.MODEL_ONLY, [
      "unverified by parser",
    ]),
    category: entry(0.5, CONFIDENCE_SOURCES.MODEL_ONLY, [
      "guessed from model description, unverified",
    ]),
  };
  return { overall: overallOf(fields), fields };
}

export { overallOf };
