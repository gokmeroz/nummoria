// backend/src/observability/trace.js
//
// The one path every model call goes through. Usage:
//
//   const trace = startTrace({ req, operation: "advisor.chat" });
//   try {
//     const res = await trace.llmCall(
//       { operation: "advisor.llm", provider: "openai", model,
//         adapter: "openai.responses", prompt: describePrompt("advisor.system", sys),
//         params: { temperature: 0.3 }, input: userPayload },
//       () => openai.responses.create({ ... }),
//     );
//     await trace.finalize("ok");
//   } catch (e) {
//     trace.markFallback();
//     await trace.finalize("partial");
//   }
//
// Design decisions baked in here:
//   - Fire-and-forget: a failed trace write NEVER touches the user's request.
//     Mirrors the existing audit() middleware.
//   - Buffered: spans and payloads are held in memory and written once, in
//     finalize(). One trace + N spans + N payloads. A mid-request crash loses
//     the whole trace (visible as a gap in the HTTP access log) — acceptable
//     at this stage, and there are no half-written partial states.
//   - No sampling yet: 100% of requests. Revisit when trace writes exceed ~5%
//     of a request's latency budget or collection growth becomes a cost issue.
//   - Disabled cleanly: AI_TRACING_ENABLED=false returns a no-op context so
//     call sites never need an `if (trace)` guard.
import crypto from "crypto";
import mongoose from "mongoose";
import AiTrace from "../models/AiTrace.js";
import AiSpan from "../models/AiSpan.js";
import AiSpanPayload from "../models/AiSpanPayload.js";
import { computeCost } from "./pricing.js";
import { redactValue } from "./redact.js";
import { RESPONSE_ADAPTERS } from "./adapters.js";

const ENABLED = process.env.AI_TRACING_ENABLED !== "false";
const STORE_PAYLOADS = process.env.AI_TRACE_STORE_PAYLOADS !== "false";
const PAYLOAD_TTL_DAYS = Number(process.env.AI_TRACE_PAYLOAD_TTL_DAYS || 30);

function currentEnv() {
  const e = process.env.NODE_ENV;
  if (e === "production") return "production";
  if (e === "test") return "test";
  return "development";
}

function normalizeError(err) {
  return {
    name: err?.name || "Error",
    message: String(err?.message || err).slice(0, 500),
    providerCode: err?.code || err?.error?.code || null,
    httpStatus: err?.status || err?.statusCode || null,
  };
}

class NoopTrace {
  get id() {
    return null;
  }
  async llmCall(_meta, fn) {
    return fn();
  }
  async span(_meta, fn) {
    return fn();
  }
  setAttributes() {}
  markFallback() {}
  async finalize() {}
}

export const noopTrace = new NoopTrace();

class TraceContext {
  constructor({ operation, userId, requestId, source, attributes }) {
    this.id = crypto.randomUUID();
    this.operation = operation;
    this.userId = userId || null;
    this.requestId = requestId || null;
    this.source = source || "live";
    this.env = currentEnv();
    this.attributes = { ...(attributes || {}) };
    this.startedAt = new Date();
    this._spans = [];
    this._payloads = [];
    this._fallbackUsed = false;
    this._finalized = false;
  }

  setAttributes(obj) {
    Object.assign(this.attributes, obj || {});
  }

  markFallback() {
    this._fallbackUsed = true;
  }

  /**
   * Run a model call inside a span. Records usage/cost/latency on success,
   * an error span on failure, and ALWAYS re-throws so existing control flow
   * (provider fallbacks, catch blocks) is unchanged.
   */
  async llmCall(meta, fn) {
    const span = {
      _id: crypto.randomUUID(),
      traceId: this.id,
      parentSpanId: meta.parentSpanId || null,
      kind: "llm",
      operation: meta.operation || this.operation,
      attempt: meta.attempt || 1,
      provider: meta.provider || null,
      model: meta.model || null,
      promptId: meta.prompt?.id || null,
      promptVersion: meta.prompt?.version ?? null,
      promptHash: meta.prompt?.hash || null,
      params: meta.params || {},
      startedAt: new Date(),
    };

    try {
      const res = await fn();
      const adapter = RESPONSE_ADAPTERS[meta.adapter] || RESPONSE_ADAPTERS.generic;
      const parsed = adapter(res);
      span.status = "ok";
      span.finishReason = parsed.finishReason ?? null;
      span.usage = parsed.usage || {};
      span.cost = computeCost(span.provider, span.model, span.usage);
      this._stashPayload(span, meta.input, parsed.output);
      return res;
    } catch (err) {
      span.status = "error";
      span.error = normalizeError(err);
      this._stashPayload(span, meta.input, null);
      throw err;
    } finally {
      span.endedAt = new Date();
      span.durationMs = span.endedAt - span.startedAt;
      this._spans.push(span);
    }
  }

  /** Generic non-LLM span (deterministic parser, tool call, judge). */
  async span(meta, fn) {
    const span = {
      _id: crypto.randomUUID(),
      traceId: this.id,
      parentSpanId: meta.parentSpanId || null,
      kind: meta.kind || "tool",
      operation: meta.operation || this.operation,
      attempt: meta.attempt || 1,
      params: meta.params || {},
      startedAt: new Date(),
    };
    try {
      const res = await fn();
      span.status = "ok";
      if (meta.captureOutput) this._stashPayload(span, meta.input, res);
      return res;
    } catch (err) {
      span.status = "error";
      span.error = normalizeError(err);
      throw err;
    } finally {
      span.endedAt = new Date();
      span.durationMs = span.endedAt - span.startedAt;
      this._spans.push(span);
    }
  }

  _stashPayload(span, input, output) {
    if (!STORE_PAYLOADS) return;

    const redact = this.env === "production";
    this._payloads.push({
      _id: span._id,
      traceId: this.id,
      input: redact ? redactValue(input) : (input ?? null),
      output: redact ? redactValue(output) : (output ?? null),
      redacted: redact,
      expiresAt: new Date(Date.now() + PAYLOAD_TTL_DAYS * 864e5),
    });
    span.payloadStored = true;
  }

  async finalize(status) {
    if (this._finalized) return;
    this._finalized = true;
    if (mongoose.connection.readyState !== 1) return;

    const endedAt = new Date();
    const llmSpans = this._spans.filter((s) => s.kind === "llm");

    const usage = llmSpans.reduce(
      (acc, s) => {
        acc.inputTokens += s.usage?.inputTokens || 0;
        acc.outputTokens += s.usage?.outputTokens || 0;
        acc.totalTokens += s.usage?.totalTokens || 0;
        return acc;
      },
      { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    );
    const costUsd = llmSpans.reduce((a, s) => a + (s.cost?.totalUsd || 0), 0);
    const priceVersion =
      llmSpans.find((s) => s.cost?.priceVersion)?.cost.priceVersion || null;

    const finalStatus =
      status ||
      (this._spans.some((s) => s.status === "error") ? "error" : "ok");

    const traceDoc = {
      _id: this.id,
      userId: this.userId,
      requestId: this.requestId,
      operation: this.operation,
      env: this.env,
      source: this.source,
      status: finalStatus,
      startedAt: this.startedAt,
      endedAt,
      durationMs: endedAt - this.startedAt,
      spanCount: this._spans.length,
      llmCallCount: llmSpans.length,
      usage,
      costUsd: Number(costUsd.toFixed(6)),
      priceVersion,
      fallbackUsed: this._fallbackUsed,
      attributes: this.attributes,
      schemaVersion: 1,
    };

    try {
      const ops = [AiTrace.create(traceDoc)];
      if (this._spans.length)
        ops.push(AiSpan.insertMany(this._spans, { ordered: false }));
      if (this._payloads.length)
        ops.push(AiSpanPayload.insertMany(this._payloads, { ordered: false }));
      await Promise.allSettled(ops);
    } catch (err) {
      // Never let instrumentation break a response.
      console.error("TRACE_WRITE_FAILED", this.id, err?.message || err);
    }
  }
}

export function startTrace(opts = {}) {
  if (!ENABLED) return noopTrace;
  const req = opts.req;
  return new TraceContext({
    operation: opts.operation || "ai.request",
    userId:
      opts.userId ?? req?.user?._id ?? req?.user?.id ?? req?.userId ?? null,
    requestId: opts.requestId ?? req?.id ?? null,
    source: opts.source || "live",
    attributes: opts.attributes || {},
  });
}
