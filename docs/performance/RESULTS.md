# Nummoria local API load-test results

2026-10-19. Starting application commit `516fdfd1b4d0d391a8a5f143b1d6a95509a40099`.
Result: **PASS** for the configured experiment. One capacity run; not a repeated or production benchmark.

## Measured plateaus

| Virtual users | Hold | Requests | Requests/s | HTTP p95 | HTTP p99 | Unexpected HTTP errors |
|---:|---:|---:|---:|---:|---:|---:|
| 1,000 | 180 s | 24,032 | 133.5 | 10.9 ms | 22.5 ms | 0.0042% (1) |
| 1,250 | 60 s | 10,065 | 167.8 | 14.9 ms | 59.9 ms | 0.0099% (1) |

Requests/s is the plateau request count divided by its configured duration, not k6’s whole-run normalized counter rate. Latencies include the requests recorded during each plateau. Login p95 is also measured separately.

## Endpoint p95

| Endpoint | 1,000 VUs | 1,250 VUs | Required |
|---|---:|---:|---:|
| GET /transactions | 11.2 ms | 15.0 ms | < 500 ms |
| GET /accounts | 8.5 ms | 12.2 ms | < 500 ms |
| GET /categories | 8.2 ms | 10.6 ms | < 500 ms |
| GET /me | 8.0 ms | 11.2 ms | < 500 ms |
| POST /transactions | 15.2 ms | 21.4 ms | < 1000 ms |

## Correctness and completeness

- 1,250 independent users authenticated through real bcrypt/JWT login. k6 recorded an actual maximum of 1,250 running VUs.
- 46,139 total HTTP requests; 0 semantic failures and 0 capacity-test HTTP 429 responses.
- 4,471 acknowledged transaction creations; 4,471 persisted. No duplicate load-write identifiers or account-balance/ownership/currency reconciliation mismatches.
- Login p95: 84.5 ms, against < 2,000 ms.
- 23 k6 thresholds evaluated. Failed thresholds: 0.
- Five-user smoke and all three external-target/runtime guard checks passed before the capacity result was accepted.
- Default limiter reproduced separately: alternating two users from one IP yielded 300 HTTP 200 responses, then two HTTP 429 responses. Capacity limits were raised only in the test child process.

## Observed transport failures

Two POST /transactions requests failed at the client transport layer: one connection reset and one EOF. Each plateau had one failure. No HTTP 4xx/5xx responses appeared in the app access log. These failures count against the error threshold; this was not an error-free run. Reconciliation found no extra persisted writes or balance discrepancies. Investigate connection reuse/keepalive behavior before claiming the cause is fixed; the cause was not established by this experiment.

## Environment and limits

- Node v22.23.3; MongoDB 7.0.28; Redis 7.2.5; k6 2.3.0.
- CPU quota `800000 100000` (8 CPU equivalents); memory limit `8589934592` (8 GiB). One API process, local MongoDB/Redis and generator share the execution environment.
- 1,250 seeded synthetic users, 1,250 accounts, 2,500 categories and 125,000 pre-existing transactions. 100 initial transactions per user.
- One login per VU; repeat 40% transaction reads, 20% account reads, 20% category reads, 10% profile reads and 10% transaction creates, with 5–10 seconds of think time. Closed workload: offered throughput decreases if responses slow.
- Local HTTP, no TLS/reverse proxy, `NODE_ENV=test`, no scheduled jobs or push worker. No auth/database mocks. No production traffic, paid model calls or real financial data.
- AI, receipt OCR, statement import, market data, mobile/web rendering and sustained soak behavior are not measured.
- Per-process OS sampling was incomplete in this execution environment. It does not establish database CPU/RSS or generator headroom. The requested VU count and achieved request rate were established by k6; app resource and pool measurements use in-process APIs.
- Peak app RSS: 314.0 MiB. Peak checked-out MongoDB connections: 11 of the unchanged default 100; checkout failures: 0. Worst one-second checkout p95: 25.0 ms. This run did not saturate the pool.

## Supported wording

“Load-tested the core finance API with 1,250 concurrent virtual users on an isolated local stack, achieving 168 requests/s with 15 ms p95 latency during a 60-second plateau; reconciled all acknowledged writes.”

Keep the workload, duration and environment attached to the claim. This is evidence of a load test, not proof of production capacity or 1,250 real users.

## Reproduction and evidence

See [the experiment design and exact commands](LOCAL_LOAD_TEST.md). All executable harness files have SHA-256 fingerprints in [environment.json](evidence/2026-10-19/environment.json).

[k6 summary](evidence/2026-10-19/k6-summary.json) · [plateau measurements](evidence/2026-10-19/plateaus.json) · [reconciliation](evidence/2026-10-19/reconciliation.json) · [threshold result](evidence/2026-10-19/result.json) · [limiter probe](evidence/2026-10-19/limiter-probe.json)

No application behavior or production rate-limit defaults were changed. Remaining work: a production-like staging run on the actual hosting tier, a longer soak, larger per-user ledgers and an arrival-rate experiment if a fixed requests/s guarantee is needed.
