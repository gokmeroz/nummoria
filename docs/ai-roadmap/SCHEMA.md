# P0 freeze: normalized transaction shape & confidence representation

This is the written decision P0's exit criteria call for — "freeze the
normalized transaction schema and confidence-score representation." It exists
so P1's cascade, P2's field-level F1, and P3's classifier can all build
against one contract instead of each inventing their own.

## Why two confidence "flavors" exist, on purpose

Before writing this, the assumption was one unified confidence design:
per-field, derived from parser/model agreement. That doesn't survive contact
with the codebase — `autoTransactionController.js` already ships a working
auto-post gate (`confidence >= AUTO_POST_THRESHOLD`) built on a **scalar**,
**rule-based** confidence over SMS/text input, and changing its shape would
break a live feature to satisfy a pipeline (PDF/CSV statement extraction)
that hasn't even shipped a cascade yet.

So there are two scoring *methods*, feeding one shared *shape*:

| | input | method | where |
|---|---|---|---|
| `rule` | free-text (SMS/notification) | fixed point-weights per field presence | `autoTransactionController.js` (unchanged) |
| `parser-self` | statement line | regex-match quality, no model call | `ai/pdfParser.js` deterministic tier |
| `agreement` | statement line | parser guess vs. model guess, matched pair | `ai/pdfParser.js`, after escalation |
| `model-only` | statement line | model found it, parser had nothing to compare | `ai/pdfParser.js`, after escalation |

Forcing these into one method would mean either weakening the SMS gate (no
model to agree/disagree with — there's no second opinion for a text message)
or pretending the PDF cascade has an agreement signal before the model has
run. Four honest methods beat one dishonest unification.

## The confidence shape (frozen)

```ts
type ConfidenceEntry = {
  value: number;        // 0..1
  source: "rule" | "parser-self" | "agreement" | "model-only";
  reasons: string[];    // short, human-readable — shown in a future correction UI
};

type TransactionConfidence = {
  overall: number;                          // min(...fields) — see below
  fields: Record<"date"|"amount"|"description"|"category", ConfidenceEntry>;
};
```

`overall = min(field values)`, not an average. A transaction is only as
trustworthy as its least-confident field — an amount you're 95% sure of next
to a category you're 35% sure of is a 35%-confidence row, not a 65% one. This
also matches the existing SMS gate's intent (`autoTransactionController.js`
sums points *up* to a threshold, which is a different but compatible
philosophy for a single-signal-quality input; statement extraction has four
independent fields with independent failure modes, so `min` is the safer
aggregation there).

Implemented in `backend/src/ai/confidence.js`:
`scoreParserSelf()`, `scoreAgreement()`, `scoreModelOnly()`.

## The escalation gate (resolves last session's open question)

The cascade can't use agreement to decide whether to call the model — that's
circular, agreement requires the model to have already run. `parseTransactionsFromText`
now escalates when **either**:

- coverage is bad: `txs.length < 5`, or
- quality is bad: `avg(overall parser-self confidence) < 0.6`

both computed from the deterministic tier alone, zero model calls spent
deciding whether to spend a model call. See `ai/pdfParser.js`.

When escalation happens, the model's result becomes the source of truth (this
was already true before — the old code just returned the model's array
outright on `txs.length < 5`). What's new: before the parser's guesses are
discarded, they're used as a cross-check. A model transaction matched to a
parser transaction on normalized `(date, amount)` gets `agreement` confidence;
one the parser never found gets `model-only` confidence, capped lower because
nothing corroborates it.

Deliberately **not** done here: merging/deduplicating parser and model
results into one list. That's a real design decision (what happens when they
disagree on an overlapping transaction beyond the fields compared here?) that
belongs to P1's cascade, not something to slip in silently while freezing a
confidence shape.

## Where this doesn't reach yet

`TransactionDraft.confidence` stays a scalar for now — nothing in the current
PDF/CSV ingest path (`ingestPdf`) creates a `TransactionDraft` at all; it
saves parsed rows to `AiAdvisorFile` and returns them straight to the client.
Wiring per-field confidence onto a Mongoose field nothing populates yet would
be dead schema. When P1 builds the correction UI and starts persisting
extraction results as drafts, `TransactionDraft.confidence` becomes
`TransactionConfidence` (the shape above) for extraction-sourced drafts,
while SMS-sourced drafts keep the existing scalar — same document shape,
`source` on the enclosing draft (`text`/`receipt`/`bank`/`csv`, already
modeled) says which one you're looking at.

`Transaction` (the posted ledger row) gains `source` and `confidence`
(scalar, `= overall` at post time) in P1, once the cascade actually writes
them — not added speculatively now.

## Golden-set annotation format

Frozen in `backend/src/eval/datasets/golden/`:

**Extraction case** (`golden/extraction/*.json`):
```ts
{
  id: string;
  layout: string;          // which synthetic bank-layout template produced it
  format: "csv" | "pdf-text";  // pdf-text = the text pdf-parse would extract;
                                // see note below on why no binary PDFs are committed
  rawText: string;
  groundTruth: Array<{ date: string; amount: number; description: string; category: string }>;
}
```
Deliberate scope cut: fixtures store the *text* a PDF would yield, not a
binary `.pdf`. `pdfParser.js`'s job — and the thing P1's F1 score is
measuring — is text→transactions. Whether `pdf-parse` correctly extracts text
from an arbitrary PDF is a different, third-party concern; testing it would
mean the eval score conflates two unrelated failure modes.

**Advisor case** (`golden/advisor/*.json`):
```ts
{
  id: string;
  profileId: string;        // synthetic profile in golden/advisor/profiles/
  question: string;
  expectedMetric: "savingsRate" | "monthlyBurn" | "riskScore" | "categoryBreakdown.<key>";
  expectedValue: number;
  tolerance: number;
}
```
`expectedValue` is computed by `computeMetrics()` (the existing deterministic
ground-truth function in `ai/financialMetrics.js`) against the profile's known
transactions — not hand-guessed. P0's eval runner checks this golden set's
*internal consistency* (re-running `computeMetrics` and diffing), not the live
advisor's answers — scoring the advisor's actual replies against these cases
needs a groundedness check, which is P4 scope.
