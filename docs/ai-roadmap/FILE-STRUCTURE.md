# Target file structure — after the 11-week AI roadmap

Projection of the repo once P0–P5 are done. Existing files are collapsed with
`… (existing)`; **new** paths are tagged with the phase that introduces them.

```
[P0] tracing + synthetic data + golden set    [P3] learned categorization
[P1] extraction pipeline                       [P4] agent + numeric grounding
[P2] eval harness + CI gate + dashboard        [P5] safety + portfolio
```

---

## backend/src/ai/  — most new code lives here

```
backend/src/ai/
├── financialMetrics.js                  … (existing — deterministic ground truth)
├── prompts/
│   ├── index.js                         … (existing)
│   ├── advisor.js               [P4]  agent system prompt + grounding rules
│   ├── extraction.js            [P1]  structured-extraction prompt
│   ├── judge.js                 [P2]  LLM-as-judge rubric prompts
│   └── registry.js              [P0]  prompt-version registry (stamped into traces)
│
├── tracing/                     [P0]
│   ├── traceModelCall.js               wrapper around every LLM / embedding call
│   ├── traceStore.js                   persists traces → ModelTrace collection
│   └── costTable.js                    per-model token pricing
│
├── extraction/                  [P1]
│   ├── index.js                        orchestrates the cascade
│   ├── detectFormat.js                 CSV / PDF / image + bank-layout guess
│   ├── cascade.js                      parser → large-model escalation by confidence
│   ├── modelExtract.js                 function-call extraction + per-field confidence
│   ├── normalize.js                    → normalized transaction schema
│   └── parsers/
│       ├── csvParser.js
│       ├── pdfParser.js
│       └── layouts/                    per-bank layout configs (~15 files)
│           ├── chase.json
│           ├── bofa.json
│           └── …
│
├── categorization/              [P3]
│   ├── index.js                        serving path: learned model + personalization
│   ├── llmCategorizer.js               baseline + label generator (demoted)
│   ├── features.js                     merchant-string embeddings / featurization
│   ├── personalization.js              per-user prior / few-shot layer
│   └── model/
│       ├── classifier.onnx             trained gradient-boosting artifact
│       └── taxonomy.json               category labels
│
├── agent/                       [P4]
│   ├── index.js                        planner / executor loop
│   ├── semanticLayer.js                NL → structured query over the store
│   ├── retrieval.js                    hybrid retrieval (tx summaries + KB)
│   ├── tools/
│   │   ├── queryTransactions.js
│   │   ├── cashflowForecast.js
│   │   ├── detectRecurring.js
│   │   └── simulateScenario.js
│   └── knowledgeBase/                  small finance KB (markdown chunks + index)
│
├── grounding/                   [P4]  ← the flagship
│   ├── guard.js                        post-generation numeric verification
│   ├── extractNumbers.js               pull figures + claims from model output
│   ├── allowlist.js                    allowed values from metrics + tx aggregates
│   └── regenerate.js                   stricter re-ask, then strip / flag fallback
│
└── safety/                      [P5]
    ├── redactPII.js                    pre-call redaction (used by traceModelCall)
    ├── promptInjectionScan.js          scan ingested documents for adversarial text
    └── policyCheck.js                  "not financial advice" check
```

## backend/src/eval/  [P2] — the harness

```
backend/src/eval/
├── run.js                              the runner (npm run eval)
├── ci.js                               CI entry: compare vs. committed baseline, exit non-zero on regression
├── scorecard.js                        aggregate + per-case report
├── judge.js                            judge invocation + calibration check
├── baseline.json                       committed baseline scores
├── assertions/
│   ├── numericGrounding.js             no ungrounded numbers
│   ├── extractionFields.js             field-level P / R / F1
│   └── toneConsistency.js
├── datasets/
│   ├── golden/                         versioned fixtures (~100+ cases)
│   │   ├── advisor/
│   │   ├── extraction/
│   │   └── categorization/
│   └── synthetic/            [P0]
│       ├── generateProfiles.js         seeded synthetic users + transactions
│       ├── generateStatements.js       synthetic statements (PDF / CSV / image)
│       └── seeds.json
└── reports/                            generated scorecards (gitignored)
```

## backend/src/ — models, controllers, routes, middleware

```
backend/src/
├── models/
│   ├── … (existing: user, transaction, account, category, subscription, …)
│   ├── transaction.js                  MODIFIED [P1] — + source, + confidence fields
│   ├── ModelTrace.js           [P0]  one row per model call
│   ├── ExtractionJob.js        [P1]  a document ingest + its cascade path
│   ├── ExtractionCorrection.js [P1]  human corrections → labeled data
│   ├── CategoryFeedback.js     [P3]  user category corrections
│   ├── AgentRun.js             [P4]  agent trajectory: tools, tokens, guard result
│   └── EvalResult.js           [P2]  a scorecard run
│
├── controllers/
│   ├── … (existing)
│   ├── ingestController.js     [P1]  (currently referenced but missing — formalized)
│   ├── extractionController.js [P1]  correction-UI endpoints
│   ├── agentController.js      [P4]  advisor / agent entrypoint
│   └── evalController.js       [P2]  dashboard data
│
├── routes/
│   ├── … (existing)
│   ├── financialHelperRoutes.js        MODIFIED [P4] — points at agentController
│   ├── ingestRoutes.js                 MODIFIED [P1]
│   ├── agentRoutes.js          [P4]
│   └── evalRoutes.js           [P2]
│
├── middlewares/
│   ├── … (existing: auth, audit, consent, requireRole)
│   └── aiQuota.js              [P4]  (currently referenced but missing — added)
│
└── services/                           (currently empty)
    └── vectorStore.js         [P4]  embedding index client (Mongo Atlas Vector / pgvector)
```

## backend/ml/  [P3] — offline training (not shipped with the server)

```
backend/ml/
├── train_categorizer.py                sentence embeddings + gradient boosting
├── benchmark.py                        learned vs. LLM: accuracy / cost / latency
├── distill.js                          big model labels an unlabeled merchant corpus
├── export_onnx.py                      → ai/categorization/model/classifier.onnx
├── requirements.txt
└── notebooks/
    └── categorizer-eda.ipynb
```

## frontend/src/  — new UI surfaces

```
frontend/src/
├── pages/
│   ├── … (existing)
│   └── Advisor.jsx              [P4]  agent chat with inline citations
├── components/
│   ├── … (existing)
│   ├── ExtractionReview.jsx     [P1]  correction UI for parsed statements
│   ├── GroundedAnswer.jsx       [P4]  renders an answer + clickable source rows
│   └── CategoryChip.jsx         [P3]  editable transaction category
├── admin/
│   └── pages/
│       └── AiQuality.jsx        [P2]  eval dashboard: groundedness, cost, p50/p95
└── lib/
    ├── … (existing: api.js, autoTransactionsApi.js)
    ├── agentApi.js              [P4]
    └── extractionApi.js         [P1]
```

## Repo root — CI, docs, config

```
nummoria-main/
├── .github/
│   └── workflows/
│       └── ai-eval.yml          [P2]  runs eval on PRs touching ai/ or prompts/, gates merge
│
├── docs/
│   ├── ai-roadmap/                      (this folder)
│   │   ├── README.md
│   │   ├── PLAN.md
│   │   ├── FILE-STRUCTURE.md            ← you are here
│   │   ├── roadmap.html
│   │   └── before-after-walkthrough.html
│   ├── adr/                     [P5]  architecture decision records
│   │   ├── 0001-extraction-cascade.md
│   │   ├── 0002-numeric-grounding-guarantee.md
│   │   └── 0003-learned-categorization.md
│   ├── benchmarks/              [P5]  public benchmark
│   │   ├── README.md
│   │   ├── statements/                  synthetic test statements
│   │   └── results.md
│   ├── model-card.md            [P5]
│   └── writeups/
│       └── driving-hallucinated-numbers-to-zero.md   [P5]
│
├── backend/
│   ├── package.json                     MODIFIED — see below
│   └── .env.example                     MODIFIED [P0/P4] — + JUDGE_MODEL, EMBEDDING_MODEL,
│                                          VECTOR_DB_URL, PII_REDACTION, EVAL_BASELINE
├── frontend/  … (existing)
└── mobile/    … (existing — receipt OCR left as-is until P1 is stable)
```

### backend/package.json — new bits

```jsonc
"scripts": {
  // … existing
  "eval":            "node src/eval/run.js",        // [P2]
  "eval:ci":         "node src/eval/ci.js",         // [P2]
  "gen:synthetic":   "node src/eval/datasets/synthetic/generateStatements.js", // [P0]
  "train:categorizer": "python backend/ml/train_categorizer.py"                // [P3]
},
"dependencies": {
  // … existing (@google/generative-ai, pdf-parse, mongoose, …)
  "openai":                "^6.x",      // [P0] structured output / function calling
  "onnxruntime-node":      "^1.x",      // [P3] serve the trained classifier
  "@xenova/transformers":  "^2.x",      // [P3] merchant-string embeddings
  "tiktoken":              "^1.x"       // [P0] token counting for traces
}
```

---

## What's new, by the numbers

| Phase | New dirs | New files (approx) | Touches existing |
|-------|:--------:|:------------------:|------------------|
| P0 | `ai/tracing/`, `eval/datasets/synthetic/` | ~8 | server bootstrap, every model call site |
| P1 | `ai/extraction/` (+ `parsers/layouts/`) | ~25 (mostly layout configs) | `transaction.js`, `ingestRoutes.js` |
| P2 | `eval/`, `.github/workflows/` | ~15 | CI config |
| P3 | `ai/categorization/`, `backend/ml/` | ~12 | categorization call site |
| P4 | `ai/agent/`, `ai/grounding/`, `services/` | ~18 | `financialHelperRoutes.js`, advisor UI |
| P5 | `ai/safety/`, `docs/adr/`, `docs/benchmarks/` | ~12 | README, `.env.example` |

Roughly **90 new files**, but ~40 of those are data (bank-layout configs, golden
cases, synthetic seeds). The load-bearing code is the ~50 modules under
`backend/src/ai/` and `backend/src/eval/`.
