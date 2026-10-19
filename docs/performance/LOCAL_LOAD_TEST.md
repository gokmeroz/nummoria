# Local API capacity experiment

Design recorded before execution, 2026-10-19, starting at `516fdfd`.
This measures an isolated API process, local MongoDB, and local Redis on one
machine. It does not establish production capacity, mobile rendering speed,
third-party service capacity, AI latency, or real-user adoption.

## Question and prediction

Can 1,000 authenticated virtual users browse and write their own financial
records while meeting the thresholds below? A second plateau at 1,250 VUs
checks whether this workload also runs above 1,000.

Prediction: the stock single-IP global limiter rejects the traffic first.
After raising only test-process rate limits, growing transaction-list responses,
JSON work and database operations are plausible bottlenecks. The MongoDB pool's
100 connections are shared across operations, not reserved per user. Pool
checkout latency and event-loop delay distinguish these hypotheses; do not
increase the pool before measuring it.

## Workload

- One independently authenticated synthetic user per VU, with one USD account,
  expense/income categories and 100 pre-existing transactions. No empty database.
- Login once per VU through the actual bcrypt/JWT login endpoint. Login latency
  is reported separately. Steady traffic uses the returned token and actual auth
  middleware, including its database lookup. No forged proxy/IP headers.
- Repeat a deterministic mix: 40% transaction lists, 20% account lists, 20%
  category lists, 10% profile reads, 10% expense creation. The first offset
  differs per user. Each VU pauses 5–10 seconds between actions, with an initial
  0–10 second stagger. This is a workload assumption, not measured user behavior.
- The frontend assembles its dashboard from records. `/stats` is a global
  marketing aggregate, not a personal dashboard endpoint, so it is excluded.
- Smoke: 5 VUs. Capacity: plateaus at 10, 100, 250, 500, 1,000 (3 minutes),
  and 1,250 (1 minute), with intervening ramps and a graceful shutdown.
- This is a closed workload: throughput can decrease as responses slow. Report
  achieved requests/second; 1,000 VUs is not 1,000 requests/second or 1,000
  simultaneously executing queries. An independent arrival-rate test is a
  separate future experiment if a fixed throughput SLO is required.

## Pass/fail rules decided in advance

For each capacity plateau at 1,000 and 1,250 VUs independently:

- Read p95 < 500 ms; transaction-create p95 < 1,000 ms.
- All-request p99 < 2,000 ms, unexpected HTTP errors < 1%, zero 429 responses.
- Zero semantic failures: expected status/shape, correct user/account ownership,
  currency, amount and successful-write representation.
- All requested VUs must actually authenticate; some successful reads and writes
  must occur at the plateau. The maximum allocated VU setting alone is not proof.
- Post-run MongoDB reconciliation: all writes acknowledged by k6 are persisted
  once, each account balance equals its signed transaction total, no unexpected
  owners, currencies or duplicate load-write identifiers.

Login p95 < 2 seconds is an additional startup threshold. A separate limiter
probe starts a fresh app with stock limits and verifies 300 successful requests
then two HTTP 429s from one IP, alternating two authenticated identities.
The capacity app uses `RATE_MAX=1000000000` and `RATE_LOGIN_MAX=1000000000` only
in that child process. Normal application code and production settings are
unchanged. This intentionally measures API capacity with relaxed IP limits;
it does not claim the deployed limiter configuration supports this traffic.

## Running

Requires Node 22, installed backend dependencies (`npm ci`), k6, a standalone
`mongod`, and `redis-server`. No container engine is required. The runner starts
its own loopback-only services on unused ports with fresh output directories;
it never accepts an existing database URI or an external base URL. Binaries are
provided by absolute paths, not downloaded by this script.

```bash
cd backend
MONGODB_BIN=/absolute/path/to/mongod \
REDIS_BIN=/absolute/path/to/redis-server \
K6_BIN=/absolute/path/to/k6 \
node src/perf/run.mjs smoke

# Run after smoke passes (roughly 8 minutes plus setup).
MONGODB_BIN=/absolute/path/to/mongod \
REDIS_BIN=/absolute/path/to/redis-server \
K6_BIN=/absolute/path/to/k6 \
node src/perf/run.mjs capacity
```

Results are in the printed `backend/perf-results/<run>/` directory: configuration,
environment, limiter probe, k6 summary, resource samples, reconciliation and
combined pass/fail result. Logs and local test credentials are intentionally
ignored by git. Only synthetic data is used. Re-running creates a new directory.

The app runs with `NODE_ENV=test` so developer `.env` files are never loaded;
the full HTTP middleware and controllers are used, with a local-only app entry
point. Scheduled jobs and push workers are not started. Providers, market APIs,
email, OCR, uploads and statement imports are outside this scenario. Redis is
real: transaction creation also removes reminder jobs even for disabled
reminders. Auth, financial operations and persistence are not mocked.

The generator, app and databases share the machine: CPU and memory contention,
loopback networking, dataset size and test duration limit interpretation.
Resource samples include app CPU/RSS, event-loop delay and MongoDB connection
checkout durations/failures. The runner also attempts OS process CPU/RSS samples
for k6 and the databases via `/proc`; these are best-effort and may be incomplete
in restricted PID namespaces or on non-Linux hosts. Missing samples do not mean
zero utilization and must not support a claim of generator/database headroom.
App access logging remains enabled and writes to a file.

Sources: [k6 ramping VUs](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/ramping-vus/),
[k6 thresholds](https://grafana.com/docs/k6/latest/using-k6/thresholds/),
[MongoDB pools](https://www.mongodb.com/docs/drivers/node/current/connect/connection-options/connection-pools/).
