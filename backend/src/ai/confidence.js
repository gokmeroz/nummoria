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
// A transaction's confidence is { overall, financial, fields: Record<field, Entry> },
// where financial = min(date, amount, description) (additive, see below) and
// overall = min(...fields) — the weakest field gates trust in the
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

// The fields money depends on. `financial` = min over these — the escalation
// gate reads it instead of `overall`, because category is never something
// the model tier fixes (it re-derives category from the same dictionary),
// so an unknown merchant must not send a clean statement to the model.
export const FINANCIAL_FIELDS = Object.freeze(["date", "amount", "description"]);

function financialOf(fields) {
  const values = FINANCIAL_FIELDS.filter((f) => fields[f]).map((f) => fields[f].value);
  return values.length ? Math.min(...values) : 0;
}

/**
 * Parser-self confidence for one deterministically parsed transaction. No
 * model call — this is what the cascade's escalation gate reads.
 *
 * These values are heuristic ranks, NOT calibrated probabilities. Whether a
 * 0.9 is right 90% of the time is measured by `npm run eval:calibrate`, and
 * on the synthetic set it is not (see docs/ai-roadmap/EVALUATION.md).
 *
 * @param {{dateRaw: string|null, dateEvidence: "unambiguous"|"document-order"|"period"|"neighbors"|"assumed",
 *   amountRaw: string|null, description: string, category: string,
 *   multiline: boolean, signFromBalance?: boolean}} ctx
 */
export function scoreParserSelf(ctx) {
  const fields = {};

  // date: how the day/month order was decided. A part > 12 (or ISO) can't
  // be read wrong; a document-wide order learned from such dates is strong;
  // a period/neighbor repair is a deliberate inference; "assumed" is the
  // fallback policy with no evidence at all.
  if (ctx.dateRaw) {
    const byEvidence = {
      unambiguous: [0.9, "day/month order unambiguous"],
      "document-order": [0.8, "day/month order taken from unambiguous dates elsewhere in the document"],
      period: [0.75, "ambiguous date resolved against the statement period"],
      neighbors: [0.75, "ambiguous date resolved against neighbouring rows' dates"],
      assumed: [0.5, "day/month order assumed (no evidence in the document)"],
    };
    const [value, reason] = byEvidence[ctx.dateEvidence] || byEvidence.assumed;
    const twoDigitYear = !/\d{4}/.test(ctx.dateRaw);
    fields.date = twoDigitYear
      ? entry(Math.min(value, 0.6), CONFIDENCE_SOURCES.PARSER_SELF, [reason, "2-digit year inferred as 2000+YY"])
      : entry(value, CONFIDENCE_SOURCES.PARSER_SELF, [reason]);
  } else {
    fields.date = entry(0.2, CONFIDENCE_SOURCES.PARSER_SELF, ["no date match"]);
  }

  // amount: a decimal marker present means the parser isn't guessing where
  // the fraction boundary is.
  if (ctx.amountRaw) {
    const hasDecimal = /[.,]\d{2}\b/.test(ctx.amountRaw);
    const reasons = [hasDecimal ? "decimal marker present" : "integer-only amount, no decimal marker"];
    if (ctx.signFromBalance) reasons.push("sign taken from running-balance change");
    fields.amount = entry(hasDecimal ? 0.9 : 0.6, CONFIDENCE_SOURCES.PARSER_SELF, reasons);
  } else {
    fields.amount = entry(0.2, CONFIDENCE_SOURCES.PARSER_SELF, ["no amount match"]);
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
  let financial = financialOf(fields);
  if (ctx.multiline) {
    // Date/amount/description spread across separate lines is a weaker
    // association than all three on one line — cap regardless of per-field
    // scores.
    overall = Math.min(overall, 0.7);
    financial = Math.min(financial, 0.7);
  }

  return { overall, financial, fields };
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

  return { overall: overallOf(fields), financial: financialOf(fields), fields };
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
  return { overall: overallOf(fields), financial: financialOf(fields), fields };
}

export { overallOf, financialOf };
