# Nummoria — AI Engineering Roadmap

Turning Nummoria from a SaaS with a thin LLM layer into a defensible AI system,
in **11 weeks**, solo and part-time (~10–15 hrs/week). The product surface barely
changes; the engineering underneath it does. Every phase ends in a measured
artifact and a resume bullet that survives interview scrutiny.

## Files

| File | What it is |
|------|------------|
| `roadmap.html` | The phased plan — six phases, timeline, per-phase workstreams, exit criteria, resume bullets, and what the 11-week compression costs. Open in a browser. |
| `before-after-walkthrough.html` | Visual walkthrough with architecture diagrams: the system today vs. after the plan, one query traced through both, a capability ledger, and the résumé before/after. |
| `file-structure.html` | Visual before/after of the repo tree — which directories and files each phase adds. |
| `PLAN.md` | Plain-text version of the roadmap for quick reading / editing in the repo. |
| `FILE-STRUCTURE.md` | Projected repo layout once P0–P5 are done, with each new path tagged by phase. |

Published (private) artifact versions:
- Roadmap: https://claude.ai/code/artifact/41fd857f-54f1-4799-936b-d534bac458b6
- Walkthrough: https://claude.ai/code/artifact/660e02d5-ecdd-4180-80b6-a9858e1a3079
- File structure: https://claude.ai/code/artifact/8ccbeed2-50eb-4244-85d9-052c6f1c396f

## The three priorities

1. **Extraction & categorization pipeline** — document ingest becomes a layered
   pipeline with a measured accuracy story; categorization moves from an LLM call
   to a trained model.
2. **Agentic analyst with numeric grounding** — an agent that reasons over the
   user's finances and cites a source for every figure; a post-generation guard
   rejects any number it can't trace to a tool result.
3. **Eval & observability harness** — quality becomes a number a pull request can
   fail on. This is what makes the other two claims credible.

## Phases at a glance

| Phase | Weeks | Outcome |
|-------|-------|---------|
| P0 · Foundations & instrumentation | 1–2 | Tracing on every model call; synthetic-data generator; ~60-case golden set; `eval` prints a scorecard. |
| P1 · Extraction pipeline | 2–5 | Multi-format extraction, two-tier confidence-gated cascade, field-level F1 per bank layout (~15 layouts), correction UI feeding labeled data back. |
| P2 · Eval & observability harness | 3–6 | Judge + assertion evals gate CI; minimal cost/latency/quality dashboard; feedback loop into the golden set. |
| P3 · Learned categorization | 6–8 | Embeddings + gradient-boosting classifier beats the LLM on accuracy, cost, latency; large model demoted to labeling. |
| P4 · Agentic analyst + grounding | 7–11 | 4-tool agent, numeric-grounding guard, 0 fabricated figures on a 150-case eval vs. a measured baseline. |
| P5 · Hardening & portfolio | 10–11 | PII redaction + prompt-injection defense; ADRs, public benchmark, before/after writeup; README leads with eval numbers. |

Phases overlap: P1/P2 and P3/P4 run in parallel; P5 folds into P4's last week.

## A note on the numbers

Every metric target (F1, cost multiples, latency, fabrication rate) is a goal each
phase must measure and report honestly. The defensible claim is the methodology
and the measured before/after — whatever the numbers land at.
