<div align="center">

<img src="frontend/src/assets/nummoria_logo.png" alt="Nummoria Logo" width="72" />

# Nummoria

**Open-source personal finance app with AI-assisted statement import and analysis**

[![CI](https://github.com/gokmeroz/nummoria/actions/workflows/ci.yml/badge.svg)](https://github.com/gokmeroz/nummoria/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-22.x-brightgreen)](https://nodejs.org)

**Live site → [nummoria.com](https://nummoria.com)**

</div>

---

## What it does

Track income, expenses and investments across multi-currency accounts; import
bank statements (CSV or text-based PDF); and ask an AI advisor about your
own numbers.

| Area | What works today |
|---|---|
| Web app (React 19 + Vite) | Dashboards, reports, charts, statement import, AI advisor chat |
| Mobile (Expo 54 / React Native 0.81) | Same core screens, receipt scanner, push notifications |
| Auth | Email/password (with email verification), Google, Apple |
| Ledger | Accounts, categories, income/expense/investment transactions, reminders, soft delete |
| Statement import | CSV (`,` `;` tab `\|`, Debit/Credit or signed Amount columns, Turkish headers) and text-layer PDFs into an account you choose. Re-uploading the same file into the same account books nothing twice. |
| AI advisor | Gemini or OpenAI (`FINANCIAL_HELPER_AGENT`); falls back to a rule-based engine without keys |
| Market data | Quotes (Yahoo Finance chart endpoint) and analyst consensus (Financial Modeling Prep) |
| Background jobs | BullMQ + Redis: transaction reminders → push notifications |

Not available: scanned/image PDF statements (no OCR in the statement path),
GitHub/Twitter sign-in, and the AI roadmap's later phases — see
[`docs/ai-roadmap/`](docs/ai-roadmap/README.md#status-as-of-2026-10-19).

## Measured extraction quality

Offline, deterministic, on **synthetic data only** (50 generated statements /
4,866 transactions in 3 layouts, plus 15 hand-written edge cases). No real
bank statements; not an untouched holdout.

| field | F1 (golden set) |
|---|---:|
| date | 99.7% |
| amount | 95.6% |
| description | 95.3% |
| category | 72.0% |

91.2% of transactions come out with date, amount and description all exact;
the remaining amount/description errors are typos and omissions injected
into the synthetic source text. Category comes from a keyword dictionary.
The model-assisted tier exists but is off by default and has not been
evaluated against a live model. Methodology, before/after numbers and
limitations: [`docs/ai-roadmap/EVALUATION.md`](docs/ai-roadmap/EVALUATION.md).

## Quick start

Prerequisites: **Node.js 22** (`backend/package.json` pins `>=22 <23`),
**MongoDB** (required), **Redis** (optional for the API, required for the
worker). `docker compose up -d` starts both locally.

Each app installs on its own — there is no root workspace.

```bash
git clone https://github.com/gokmeroz/nummoria.git
cd nummoria

# API — http://localhost:4000
cd backend
npm ci
cp .env.example .env      # works as-is against a local MongoDB; see comments inside
npm run dev               # node --watch; `npm run dev:all` also starts the worker

# Web — http://localhost:5173 (talks to http://localhost:4000)
cd ../frontend
npm ci
npm run dev

# Mobile (Expo Go)
cd ../mobile
npm install
npx expo start            # optional: cp .env.example .env and set EXPO_PUBLIC_API_URL
```

**Services and failure behaviour**

- **MongoDB missing/unreachable:** the API exits with
  `MongooseServerSelectionError` after ~8 s; it never serves requests.
- **Redis missing:** the API starts and serves requests. Reminder scheduling
  times out after 2 s and is logged (the transaction write still succeeds);
  the AI quota counter falls back to memory. `npm run worker` needs Redis.
- **No AI keys:** the advisor answers with its rule-based engine; statement
  import uses the deterministic parser (it never needs a model).

Optional integrations (Google/Apple OAuth, Gmail verification email, SMTP,
FMP market data, receipt OCR via `tesseract`) are each disabled when their
variables are empty; [`backend/.env.example`](backend/.env.example)
lists every variable the code reads.

## Commands

Run from `backend/` unless noted.

| command | what it does |
|---|---|
| `npm run dev` / `npm start` | API with / without file watching |
| `npm run worker` | reminder + push workers (Mongo + Redis) |
| `npm test` | unit tests; DB-backed suites skip without `MONGO_TEST_URI` |
| `MONGO_TEST_URI=mongodb://127.0.0.1:27017 npm test` | + integration tests (ownership, import idempotency, recurring job, tracing); each suite uses and drops its own `nummoria_test_*` database |
| `npm run test:coverage` | same, with coverage → `coverage/lcov.info` |
| `npm run eval` | offline extraction + advisor-arithmetic eval; fails on `src/eval/thresholds.json` |
| `npm run eval:calibrate` | does parser confidence predict correctness? |
| `npm run eval:live -- --max-llm-cases 5` | **paid**, opt-in: let up to N hard PDFs escalate to the configured model |
| `npm run gen:synthetic` | 100 labelled synthetic statements (CSV + PDF) → `src/eval/datasets/synthetic/output/` |
| `npm run build` (in `frontend/`) | production web build |

Representative `npm run eval` output:

```
| track      | rows | date F1 | amount F1 | description F1 | category F1 | exact rows |
| golden     | 4866 |   99.7% |     95.6% |          95.3% |       72.0% |      91.2% |
| regression |   63 |  100.0% |    100.0% |         100.0% |       69.8% |     100.0% |
| pdfBinary  | 2346 |   99.4% |     95.6% |          94.8% |       69.8% |      90.8% |
Advisor arithmetic self-consistency: 12/12 (not a measure of answer quality)
Quality gate: PASSED (28 checks)
```

## CI

`.github/workflows/ci.yml` runs on pushes to `main` and on pull requests:
backend `npm ci`, unit + MongoDB integration tests with coverage, the offline
eval gate, a check that the synthetic generator reproduces the committed
golden fixtures; web `npm ci`, lint, build. Reports are uploaded as
artifacts. No secrets, paid APIs or production services are used. Mobile
builds, live model evaluation and load testing are not part of CI.
A one-off local load test (1,250 virtual users, 15 ms p95) is documented in
[`docs/performance/RESULTS.md`](docs/performance/RESULTS.md).

## Project structure

```
backend/   Express API (src/ai: parsers, confidence, metrics; src/eval: eval harness;
           src/observability: tracing; src/integration: DB-backed tests)
frontend/  React + Vite web app
mobile/    Expo / React Native app
docs/ai-roadmap/  AI engineering plan, schema decisions, evaluation evidence
```

## Deployment notes

The production stack is Vercel (web), Railway (API), MongoDB Atlas and
Upstash Redis. `frontend/.env.production` holds the public production API
URL. The API runs with Mongoose `autoIndex` off in production; the unique
indexes that import and recurring-job idempotency depend on are created by
that code on first use.

## Contributing

Pull requests are welcome; CI must pass. For a change that moves eval
numbers, explain it in `docs/ai-roadmap/EVALUATION.md` — thresholds are not
lowered to make a run pass.

## License

MIT © 2025 [Göktuğ Mert Özdoğan](https://github.com/gokmeroz)
