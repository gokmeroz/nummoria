// AI tracing: what gets persisted for successful, failed and unpriced model
// calls, payload retention/redaction, and that a broken trace store never
// breaks the request.
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { dbSuiteOptions, connectTestDb, disconnectTestDb } from "../test/helpers.js";

describe("AI tracing", dbSuiteOptions(), () => {
  let startTrace, AiTrace, AiSpan, AiSpanPayload;

  before(async () => {
    await connectTestDb("trace");
    ({ startTrace } = await import("../observability/trace.js"));
    ({ default: AiTrace } = await import("../models/AiTrace.js"));
    ({ default: AiSpan } = await import("../models/AiSpan.js"));
    ({ default: AiSpanPayload } = await import("../models/AiSpanPayload.js"));
  });
  after(disconnectTestDb);

  const openaiReply = (usage) => ({ output_text: "[]", status: "completed", usage });
  const meta = (over = {}) => ({
    operation: "extract.llm",
    provider: "openai",
    model: "gpt-4o-mini",
    adapter: "openai.responses",
    prompt: { id: "extract.transactions", version: 1, hash: "abc123" },
    input: "statement text",
    ...over,
  });

  test("a successful priced call records usage, cost, prompt identity and a TTL'd payload", async () => {
    const trace = startTrace({ operation: "ingest.document", userId: null });
    await trace.llmCall(meta(), async () => openaiReply({ input_tokens: 1000, output_tokens: 500, total_tokens: 1500 }));
    assert.equal(await trace.finalize("ok"), true);

    const t = await AiTrace.findById(trace.id).lean();
    assert.equal(t.status, "ok");
    assert.equal(t.llmCallCount, 1);
    assert.deepEqual([t.usage.inputTokens, t.usage.outputTokens], [1000, 500]);
    assert.equal(t.costUsd, 0.00045);
    assert.equal(t.uncostedLlmCallCount, 0);
    const [span] = await AiSpan.find({ traceId: trace.id }).lean();
    assert.deepEqual([span.promptId, span.promptVersion, span.promptHash], ["extract.transactions", 1, "abc123"]);
    const payload = await AiSpanPayload.findById(span._id).lean();
    const days = (payload.expiresAt - Date.now()) / 864e5;
    assert.ok(days > 29 && days <= 30, `payload expires in ~30 days, got ${days}`);
  });

  test("an unpriced or usage-less call makes the trace's cost unknown, not zero", async () => {
    const trace = startTrace({ operation: "ingest.document" });
    await trace.llmCall(meta(), async () => openaiReply({ input_tokens: 10, output_tokens: 10, total_tokens: 20 }));
    await trace.llmCall(meta({ model: "some-new-model" }), async () => openaiReply({ input_tokens: 10, output_tokens: 10 }));
    await trace.llmCall(meta(), async () => openaiReply(undefined));
    await trace.finalize();
    const t = await AiTrace.findById(trace.id).lean();
    assert.equal(t.costUsd, null);
    assert.equal(t.uncostedLlmCallCount, 2);
    assert.equal(t.usageComplete, false);
  });

  test("a failed call is recorded as an error span and still re-thrown to the caller", async () => {
    const trace = startTrace({ operation: "advisor.chat" });
    await assert.rejects(
      trace.llmCall(meta(), async () => {
        throw Object.assign(new Error("upstream 503"), { status: 503 });
      }),
      /upstream 503/,
    );
    await trace.finalize();
    const t = await AiTrace.findById(trace.id).lean();
    assert.equal(t.status, "error");
    const [span] = await AiSpan.find({ traceId: trace.id }).lean();
    assert.equal(span.status, "error");
    assert.equal(span.error.httpStatus, 503);
  });

  test("production payloads are redacted before storage", async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const trace = startTrace({ operation: "advisor.chat" });
      await trace.llmCall(meta({ input: "user jane@example.com card 4111 1111 1111 1111" }), async () => openaiReply({}));
      await trace.finalize();
      const [span] = await AiSpan.find({ traceId: trace.id }).lean();
      const payload = await AiSpanPayload.findById(span._id).lean();
      assert.equal(payload.redacted, true);
      assert.equal(payload.input, "user [email] card [num:16d]");
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  test("a failing trace store is logged and never throws into the request", async () => {
    const trace = startTrace({ operation: "advisor.chat" });
    await trace.llmCall(meta(), async () => openaiReply({}));
    // Force the AiSpan insert to fail: a span id that already exists.
    const spanId = trace._spans[0]._id;
    await AiSpan.create({ ...trace._spans[0], status: "ok", _id: spanId });
    const errors = [];
    const orig = console.error;
    console.error = (...a) => errors.push(a.join(" "));
    try {
      assert.equal(await trace.finalize(), false);
    } finally {
      console.error = orig;
    }
    assert.ok(errors.some((e) => e.includes("TRACE_WRITE_FAILED") && e.includes("AiSpan")));
    assert.ok(await AiTrace.findById(trace.id), "the trace row itself still landed");
  });
});
