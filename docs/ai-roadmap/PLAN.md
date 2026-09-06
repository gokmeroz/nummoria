# Nummoria AI Engineering Roadmap — 11 weeks

Solo, part-time (~10–15 hrs/week). Phases overlap heavily. Every metric below is a
target to measure and report honestly; the defensible claim is the methodology and
the before/after, not the specific number.

## Sequencing logic

- The full eval harness isn't phase one, but its two hardest-to-retrofit pieces —
  request tracing and a labeled golden set — are. Bolting instrumentation onto a
  running system later is miserable.
- Extraction precedes the agent because the agent's value (never inventing a
  number) depends on a clean typed transaction store to ground against.
- Categorization comes after extraction because it needs the labeled corpus the
  correction UI produces.
- The agent comes last because it consumes everything built before it.

---

## P0 · Foundations & instrumentation — weeks 1–2

**Goal:** build the runway. Nothing ships to users; everything after depends on it.

Workstreams
- Synthetic generator for bank statements + transaction histories: multiple bank
  templates, PDF/CSV/image output, controllable noise and edge cases.
- Golden eval set v1: ~60 hand-labeled cases (extraction fields + advisor Q&A),
  versioned fixtures.
- Tracing wrapper on every model call: prompt version, tokens, cost, latency, tool
  calls, raw output → queryable store.
- Freeze the normalized transaction schema and confidence-score representation.

Exit criteria
- Every AI request emits a trace row.
- `npm run eval` runs end-to-end and prints a scorecard (even if scores are poor).
- Generator produces 100 labeled statements in one command.

Resume claim: none yet — this is scaffolding.

---

## P1 · Extraction pipeline — weeks 2–5 (depends on P0 tail)

**Goal:** turn document ingest from a single parse call into a layered pipeline
with a cost story and a measured accuracy story.

Workstreams
- Deterministic layer: format detection + per-format CSV/PDF parsers, extending
  existing ingest code.
- Model extraction with structured output (function calling / constrained JSON) +
  per-field confidence scores.
- Two-tier cascade: deterministic parser → large model, escalating only when
  parser confidence is below threshold (small-model middle tier is a later add).
- Human-in-the-loop correction UI; each correction written back as a labeled
  training example.
- Field-level precision / recall / F1 on the P0 eval set, broken out by bank layout.

Exit criteria
- Field-level F1 ≥ 0.93 aggregate, with a per-layout breakdown.
- Cost per document and cascade escalation rate on the dashboard.
- ≥ 15 distinct layouts in the eval set.

Resume claim: *Built a multimodal bank-statement extraction pipeline (PDF/image/CSV)
with a confidence-gated cascade — ~95% field-level F1 across 15+ layouts, with the
deterministic tier handling the majority of documents at near-zero model cost.*

---

## P2 · Eval & observability harness — weeks 3–6 (parallel to P1)

**Goal:** make quality a number a pull request can fail on. This makes every other
claim credible.

Workstreams
- LLM-as-judge scoring + deterministic assertion checks; grow the golden set past
  100 cases.
- CI integration: a prompt or model change that regresses the score against
  baseline blocks the merge.
- Minimal dashboard: p50/p95 latency, cost per active user, groundedness,
  hallucinated-number rate, PII-leak checks.
- Online loop: thumbs feedback → triage queue → promotion of real cases into the
  golden set.

Exit criteria
- A deliberately worse prompt fails CI in a demo run.
- Dashboard live and populated from real traffic.
- Quality report generated on demand from the trace store.

Resume claim: *Built an LLM eval harness (100+ golden cases, judge + deterministic
assertions) wired into CI; it blocked silent quality regressions from model and
prompt changes before release.*

---

## P3 · Learned categorization — weeks 6–8 (depends on P1, P2)

**Goal:** replace an LLM call with a real trained model — the clearest signal of
classical ML skill, not just prompt engineering.

Workstreams
- Baseline: measure the current LLM zero-shot categorizer on accuracy, latency, cost.
- Train one classifier on merchant strings: sentence embeddings + gradient boosting
  (commit to this; skip the transformer bake-off for now).
- Head-to-head benchmark across all three axes on a held-out set.
- Personalization: user corrections shift predictions via a per-user few-shot /
  prior layer.
- Handle cold start and new merchants.

Exit criteria
- Learned model beats the LLM baseline on at least two of three axes.
- Large model retained only to generate training labels.
- Personalization measurably improves per-user accuracy.

Resume claim: *Replaced an LLM transaction categorizer with an embeddings +
gradient-boosting classifier: higher accuracy, ~40× cheaper, sub-10 ms p95; large
model kept only for training-label generation.*

---

## P4 · Agentic analyst + grounding — weeks 7–11 (depends on P0, P2; P1, P3 feed it)

**Goal:** the flagship demo — an agent that reasons over the user's finances and
cites a source for every figure it states.

Workstreams
- Semantic layer: natural language → structured query over the transaction store
  (text-to-analytics), not raw rows in context.
- Four tools: `query_transactions`, `cashflow_forecast`, `detect_recurring`,
  `simulate_scenario` (market-data and cohort tools are a later add).
- Planner / executor loop with tool-selection evals and full-trajectory evals.
- Numeric-grounding guard: a post-generation pass rejects any number not traceable
  to a tool result.
- Retrieval over transaction summaries + a small knowledge base; answers cite
  specific transactions.

Exit criteria
- Zero fabricated figures across a 150-case eval; prompt-only baseline measured for
  contrast.
- Groundedness score meets target; trajectory eval pass rate reported.
- Every numeric answer links to its source rows in the UI.

Resume claim: *Designed a 4-tool financial analysis agent with a deterministic
numeric-grounding guard — 0 fabricated figures across a 150-case eval versus a
measured double-digit rate in the prompt-only baseline.*

---

## P5 · Hardening & portfolio — weeks 10–11 (folds into P4's last week)

**Goal:** close the safety gaps and make the work legible to someone reviewing the
repo in ten minutes.

Workstreams
- Safety layer: PII redaction before any model call, prompt-injection defense on
  ingested documents, a "not financial advice" policy check.
- Portfolio artifacts: public eval dashboard / model card, ADRs for the cascade and
  the grounding guarantee, a benchmark repo of synthetic statements, a writeup —
  "driving hallucinated numbers to zero".
- README rewrite: lead with eval numbers and a trace-visible demo.

Deferred to a later pass: semantic cache, query-complexity model router,
claim-verification model.

Exit criteria
- An injected-instruction test document does not alter agent behavior.
- No PII reaches the model provider in a 50-request sample.
- A stranger can understand the system from the README alone.

Resume claim: *Shipped a pre-inference PII-redaction and prompt-injection defense
layer for an LLM finance product, verified against an adversarial document test
set — and published the benchmark, ADRs and writeup.*

---

## What the 11-week compression costs (vs. an 18-week version)

- Extraction covers ~15 bank layouts, not 30+; cascade is two tiers, not three.
- Golden set lands near 100 cases, not 120+; dashboard is functional, not polished.
- Categorization commits to one model family instead of a transformer bake-off.
- The agent ships 4 tools, not 7 — market-data and cohort comparison come later.
- Cost engineering (semantic cache, model router) is deferred entirely.

The core story is intact: every phase still ends in a measured artifact, and the
numeric-grounding claim — the flagship — is untouched.

---

## Résumé: before vs. after

**Before**
> Built a personal-finance web & mobile app with an AI chat assistant. React,
> React Native, Node, MongoDB, OpenAI API.

**After**
- Multimodal bank-statement extraction pipeline, confidence-gated cascade, ~95%
  field-level F1 across 15+ layouts.
- LLM eval harness (100+ cases, judge + assertions) wired into CI; blocks quality
  regressions on prompt / model changes.
- Replaced an LLM categorizer with an embeddings + gradient-boosting model: higher
  accuracy, ~40× cheaper, sub-10 ms p95.
- 4-tool financial agent with a deterministic numeric-grounding guard — 0
  fabricated figures across a 150-case eval.
- Pre-inference PII-redaction + prompt-injection defense layer, verified against an
  adversarial document set.
