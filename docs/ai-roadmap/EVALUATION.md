# Extraction & advisor evaluation — methodology and evidence

What `npm run eval` measures, how, and what changed in the parser-repair
pass on top of commit `24b854d2`. Machine-readable evidence lives in
[`eval-evidence/`](eval-evidence/); the gate's thresholds live in
[`backend/src/eval/thresholds.json`](../../backend/src/eval/thresholds.json).

**Everything here is measured on synthetic or hand-written data.** No real
bank statement, real user, or live model call contributed to any number on
this page.

## 1. What is (and isn't) measured

| track | what it exercises | label in the report |
|---|---|---|
| `extraction.golden` | statement **text** → transactions, deterministic tier, on the 50 golden fixtures | `deterministic-text-to-transactions` |
| `extraction.regression` | same code, 15 hand-labelled cases for input shapes the golden set lacks | (same) |
| `extraction.pdfBinary` | the 24 golden pdf-text cases rendered to **real PDFs** (jsPDF), then `pdf-parse` → text → transactions | `synthetic-text-layer-pdfs` |
| `advisor` | re-runs `computeMetrics()` against 12 fixtures | `deterministic-arithmetic-self-consistency` |

Not measured: OCR / scanned or image PDFs, real bank PDFs or exports, the
model-assisted extraction tier (no paid run was authorized — see §6), and
the quality of advisor answers (12/12 above means the arithmetic is
self-consistent, nothing about what the model says).

## 2. Datasets

**Golden set** (`backend/src/eval/datasets/golden/extraction/`, unchanged):
50 fixtures, 4,866 transactions, 3 layouts (`us-checking`, `us-credit-debit`,
`tr-katilim`), 26 CSV + 24 PDF-text. Generated from fixed seed 12345 by
`npm run gen:synthetic -- --golden`; CI regenerates them and fails on any
byte difference. Each layout injects noise into the *rendered text only*
(ground truth keeps the true values): one-digit "OCR" typos in amounts
(5–6%), missing descriptions (3–5%), per-row DD/MM swaps on ambiguous dates
(40–60%), multi-line rows, extra whitespace.

This set has been used throughout development, so it is **not a holdout**,
and after this pass it is **saturated** for the deterministic tier: every
remaining date/amount/description error is noise that is absent from the
source text (§5). It can catch regressions; it can no longer show
improvements.

**Regression set** (`backend/src/eval/datasets/regression/extraction/`, new):
15 hand-written cases, 63 rows — ISO dates with a period header, a running
balance column (signed, and unsigned debit/credit recoverable only from the
balance), Turkish thousands separators and characters, `(x)`/`x-`/`DR`/`CR`
signs, multi-line descriptions across a page break, repeated legitimate
transactions, a CSV with BOM + preamble + Debit/Credit columns, a year
boundary, blank/invalid/TOTAL rows, Turkish CSV headers, unknown merchants,
FX lines carrying two amounts, and documents with no date-order evidence.
It was **written alongside the fixes** — it demonstrates that these
behaviours are covered; it is not evidence of generalization.

Both sets are pinned by a SHA-256 content fingerprint in `thresholds.json`;
editing an expected answer fails the gate until the thresholds are
deliberately re-recorded.

## 3. Methodology

**Matching.** An extracted row and a ground-truth row can pair only if at
least two of three signals agree: exact date, exact amount (±0.005), and
description token overlap ≥ 0.5. Candidates are assigned best-first across
the whole case (score `2·date + 2·amount + overlap`, ties to the nearest row
position), one-to-one.

The previous scorer matched greedily in extracted-row order and accepted a
single signal (score ≥ 1). Both were defects: its result depended on output
order (the same rows scored 0 or 2 description TPs depending on order —
`scorecard.test.js` pins this), and it could pair an unrelated row on one
field and hand out a free true positive.

**Counting.** A matched pair is a TP per agreeing field and FP+FN per
disagreeing field; an unmatched extracted row is an FP for every field; an
unmatched ground-truth row an FN for every field. Repeated legitimate
transactions match one-to-one, so extracting one of two identical coffees is
one FN.

**Aggregation** is micro-averaged (TP/FP/FN summed over all rows of all
cases). Reported per field, per layout, and per format, plus
**financial exact-row recall**: the share of ground-truth rows recovered with
date, amount and description all exact — "would this row be right in the
ledger", independent of category.

**Determinism.** Fixtures load in sorted order; the parser has no
randomness; two runs produce identical reports (`--compare` shows +0.0
everywhere).

**Failure behaviour.** Invalid fixtures, duplicate ids, an empty dataset, a
changed fingerprint, a malformed report (e.g. a NaN F1) or any threshold
miss make the run fail. Exit codes: `0` pass, `1` a threshold failed, `2`
invalid dataset/report/thresholds.

## 4. Before / after

### 4a. The measurement itself was wrong

At `24b854d2`, the eval's CSV track scored
`financialHelperController.csvToTxRows` — a function **no route called**. The
upload routes used `ingestController`'s CSV parser, which differed in both
directions:

| (HEAD code, HEAD scorer) | eval as shipped (`csvToTxRows`) | production CSV path |
|---|---:|---:|
| tr-katilim amount F1 | 57.2% | 95.2% |
| us-credit-debit amount F1 | 95.9% | 73.2% |

The eval read every semicolon-delimited Turkish CSV as zero rows (it tried
`,` first, which "succeeds" as a one-column table), while the production
parser handled `;` — but production had no Credit/Debit column support, so
every us-credit-debit CSV upload silently produced zero rows. Now both
routes and the eval call one parser (`ai/csvParser.js`) and one normalizer
(`ai/statementNormalize.js`).

### 4b. Golden set, aggregate F1

| | date | amount | description | category | exact rows |
|---|---:|---:|---:|---:|---:|
| HEAD, eval as shipped ([01](eval-evidence/01-head-as-audited.json)) | 76.8% | 82.2% | 83.0% | 34.9% | — |
| HEAD, production paths, new scorer ([03](eval-evidence/03-head-production-paths-new-scorer.json)) | 83.2% | 90.0% | 90.1% | 32.4% | 72.4% (3,522) |
| **after** ([after](eval-evidence/after.json)) | **99.7%** | **95.6%** | **95.3%** | **72.0%** | **91.2% (4,438)** |

Rows extracted: 4,362 → 4,866 (ground truth: 4,866). The like-for-like
comparison is row 2 → row 3 (same scorer, production code paths).

### 4c. Golden set, F1 by layout (date / amount / description / category)

| layout | HEAD as shipped | HEAD production, new scorer | after |
|---|---|---|---|
| us-credit-debit | 90.2 / 95.9 / 97.0 / 24.8 | 72.0 / 73.1 / 74.3 / 30.8 | 99.8 / 96.1 / 96.7 / 49.3 |
| tr-katilim | 55.5 / 57.2 / 57.3 / 57.3 | 87.3 / 94.9 / 94.1 / 40.9 | 99.5 / 95.4 / 94.6 / 94.6 |
| us-checking | 85.6 / 94.4 / 95.6 / 22.3 | 85.4 / 94.9 / 95.4 / 22.2 | 99.7 / 95.3 / 95.0 / 61.1 |

By format (HEAD production → after): CSV 72.4 / 84.5 / 84.2 / 0.0 →
99.7 / 95.4 / 95.5 / 73.8; PDF-text 93.8 / 95.4 / 95.9 / 63.8 →
99.6 / 95.8 / 95.1 / 70.1.

### 4d. Regression set (63 rows)

| | date | amount | description | category | exact rows |
|---|---:|---:|---:|---:|---:|
| HEAD production paths ([04](eval-evidence/04-head-regression-set.json)) | 80.0% | 67.8% | 62.6% | 27.8% | 49.2% |
| after | 100% | 100% | 100% | 69.8% | 100% |

At HEAD: the ISO-dated, CSV-preamble/BOM and Turkish-header (`İşlem
Tarihi`) cases scored 0 on every financial field (no usable rows); in both
balance-column cases every amount was the balance; `(45.00)`, `23.10-` and
`95.00 DR` came out positive (3 of 5 amounts wrong); the year-boundary and
dot-dated no-evidence cases misdated 2 of 4 and 3 of 3 rows.

### 4e. PDF stage (`pdfBinary`, 2,346 rows)

date 99.4%, amount 95.6%, description 94.8%, exact rows 90.8% — versus
99.6 / 95.8 / 95.1 for the same cases as plain text. The gap is 10 lines
that come out of `pdf-parse` letter-spaced and garbled (`0 2 . 0 5 … M A A ^`).
Root cause (reproduced in isolation): jsPDF's built-in Courier font has no
glyphs for `Ş`/`İ`, so the **generator** writes those lines in a fallback
encoding. This is a test-data artifact, not a parser defect — real Turkish
bank PDFs embed fonts that cover these characters — and it is left in
place (the alternative was bundling a Unicode font) and documented.

## 5. What was fixed, by root cause

Fixes are general rules; none references a fixture id, layout id, or
merchant from the synthetic layouts (one exception called out below).

| root cause | effect at HEAD | fix |
|---|---|---|
| eval scored dead code (§4a) | wrong numbers both ways | one shared CSV parser for routes + eval |
| no Credit/Debit CSV support in production | us-credit-debit CSV uploads → 0 rows | Credit/Debit/Borç/Alacak columns → signed amount |
| ambiguous DD/MM with MM-first default | DD.MM statements misdated | document-wide order from unambiguous dates; explicit policy when there is none (`.` → day-first, `/` → month-first, confidence 0.5); statement period (header, or inferred from unambiguous dates) repairs per-row swaps; chronological neighbours settle swaps where both readings fit the period |
| multi-line row with no description consumed the next row's line | lost transactions | a line carrying a date is never taken as a description |
| CSV rows never categorized; keyword substring matches (`bar`→BARBER, `fon`→TELEFON) | category 0% on CSV | shared `guessCategory`, per-keyword word boundaries (Turkish stems keep suffixes), Unicode folding |
| `gas` → Utilities for GAS STATION (278 rows) | category | phrase rule `gas station` → Transport. **Found on the golden set**, so its category gain is in-sample. |
| ISO dates, balance columns, sign conventions, preambles, page headers, impossible dates (regression set) | see §4d | tokenized parse: dates masked before amounts are read; balance column by header or running-balance arithmetic (and sign from the balance change); summary/opening-balance lines skipped; continuation lines joined; invalid calendar dates rejected |

Date accuracy was cross-checked without the scorer: on the 26 CSV cases,
rows align 1:1 with ground truth, and all 2,520 dates are correct; exactly
565 rows had a swapped day/month in the source text and exactly 565 were
repaired (421 by period, 144 by neighbours).

**Remaining errors on the golden set** (after, by direct alignment):
amount — 216, every one a one-digit typo present in the source text;
description — 229, every one absent from the source text; date — 0 in
aligned rows (the 0.3 pt gap is 17 rows carrying both kinds of noise, which
can't be matched); category — 1,361 rows across 46 merchant strings no rule
knows. Category labels are deliberately **not** extended with the synthetic
merchants: that would be in-sample tuning of a dictionary that P3 replaces
with a learned model.

## 6. Confidence and the model cascade

**Confidence is a rank, not a probability.** `npm run eval:calibrate` on the
24 golden PDF-text cases: date confidence 0.75/0.80/0.90 → 100% correct
(under-confident by 10–25 pts), amount 0.90 → 96.1%, description 0.35 →
0% (these are the empty descriptions — correctly flagged), category
0.35 → 0%, 0.75 → 100%. Nothing downstream should read these as
probabilities.

**Escalation gate.** The cascade escalated when mean `confidence.overall`
(min of all four fields) was < 0.6. Category dominated that minimum, so an
unknown merchant escalated a clean statement — and the model tier can't fix
category (it re-derives it from the same dictionary). Measured on HEAD: **15
of 24** golden PDFs would escalate, and the escalated ones had *higher*
date+amount recall (91.0%) than the kept ones (87.8%).

The gate now reads `confidence.financial` = min(date, amount, description)
(an additive field; `overall` is unchanged), threshold still 0.6:
**0 of 24** golden PDFs escalate. No threshold separates good from bad
documents on this set (recall of escalated ≈ kept at every t), because the
remaining errors are invisible to the parser and to any model. So
`EXTRACTION_ESCALATION` stays **off** by default; there is no evidence yet
that escalating improves anything.

**What is verified about the model tier** (mocked providers,
`ai/pdfParser.test.js`): a confident parse makes no call; offline, no
provider, and denied budget are distinct reported outcomes (`skipped:*`),
never labelled as model results; malformed JSON, non-arrays, empty output,
provider errors, timeouts, and answers with fewer rows than the parser found
all fall back to the deterministic rows (`failed:*`); every model row is
validated (real calendar date, finite number, string description) and
invalid rows are counted, not coerced; a provider error falls through to the
next provider; the prompt fences the statement as untrusted data. Model rows
never reach the ledger (`/ingest/pdf` is deterministic-only).

**What is not verified**: actual model accuracy, cost per document, and
latency. A bounded live run is available but was not executed:

```bash
cd backend
npm run eval:live -- --max-llm-cases 5   # needs GEMINI_API_KEY or OPENAI_API_KEY; each escalation is a paid call
```

It escalates at most N cases, and reports `model-assisted` only if a call
was actually allowed and made; otherwise it says why it stayed
deterministic.

## 7. Regression gate in CI

`backend/src/eval/thresholds.json` (version 1) holds measured values minus a
stated tolerance — financial fields −0.5 pt aggregate / −1.0 pt per layout,
category −2.0 pt aggregate only, the regression set at 100%, advisor
arithmetic at 100% — plus the dataset fingerprints. Thresholds are never
lowered to make a run pass; re-recording them is a reviewed change.

The gate was checked against a deliberate regression (changing the
no-evidence date policy to always month-first): the golden set — whose
Turkish documents all contain deciding dates — did not move, and the
regression set failed the run with exit code 1.

## 8. Reproduce

```bash
cd backend
npm ci
npm run eval                         # all tracks + gate; report in src/eval/reports/
npm run eval -- --out r.json --compare ../docs/ai-roadmap/eval-evidence/after.json
npm run eval:calibrate               # confidence reliability + threshold sweep
npm run gen:synthetic -- --golden    # must leave golden/extraction unchanged
```

The "HEAD production paths" rows were measured with
[`eval-evidence/reproduce-head-baseline.mjs`](eval-evidence/reproduce-head-baseline.mjs)
(instructions in its header).
