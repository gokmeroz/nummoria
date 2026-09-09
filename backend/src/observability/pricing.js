// backend/src/observability/pricing.js
//
// Token → USD conversion, frozen onto each span at write time.
//
// Why compute-at-write instead of joining a live price list at read time:
// provider prices change. If cost is derived from "today's prices" every time
// you read, your historical numbers move retroactively and "did the P1 cascade
// cut cost?" becomes unanswerable. Freezing the number + a priceVersion makes
// each row immutable and reproducible; raw token counts are still stored if a
// recompute is ever needed.
//
// These are approximate published USD prices per 1,000,000 tokens. VERIFY
// against the provider pricing pages before trusting a cost dashboard, and bump
// PRICE_TABLE_VERSION whenever a number here changes.
export const PRICE_TABLE_VERSION = "2026-09-06";

const PRICES = {
  "openai:gpt-4o-mini": { inputPerMTok: 0.15, outputPerMTok: 0.6 },
  "gemini:gemini-2.5-flash": { inputPerMTok: 0.3, outputPerMTok: 2.5 },
};

/**
 * @returns {{ totalUsd: number|null, priceVersion: string|null }}
 *   null when the model is not in the table or usage is empty — callers still
 *   store raw token counts, so cost can be backfilled later.
 */
export function computeCost(provider, model, usage = {}) {
  const p = PRICES[`${provider}:${model}`];
  const inTok = usage.inputTokens ?? 0;
  const outTok = usage.outputTokens ?? 0;

  if (!p || (!inTok && !outTok)) {
    return { totalUsd: null, priceVersion: null };
  }

  const totalUsd =
    (inTok / 1e6) * p.inputPerMTok + (outTok / 1e6) * p.outputPerMTok;

  return { totalUsd: Number(totalUsd.toFixed(6)), priceVersion: PRICE_TABLE_VERSION };
}
