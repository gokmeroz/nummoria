// backend/src/models/AiSpan.js
//
// One row per operation inside a trace: today a model call, in P1 a
// deterministic parse attempt, in P4 an agent tool call. Spans form a tree via
// parentSpanId; traceId is denormalized onto every span so "give me the whole
// trace" is one indexed query with no graph traversal.
//
// Append-only. A span is written once, when the operation finishes.
import mongoose from "mongoose";

const { Mixed } = mongoose.Schema.Types;

const AiSpanSchema = new mongoose.Schema(
  {
    _id: { type: String }, // UUID

    traceId: { type: String, required: true, index: true },
    parentSpanId: { type: String, default: null },

    kind: {
      type: String,
      enum: ["llm", "parser", "tool", "judge", "embedding"],
      required: true,
    },
    operation: { type: String, required: true },
    // Retries of the same logical call are sibling spans sharing operation +
    // parentSpanId, distinguished by attempt. You WANT the failed attempt on
    // record, so each try is its own span.
    attempt: { type: Number, default: 1 },

    status: { type: String, enum: ["ok", "error", "timeout"], required: true },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, required: true },
    // Denormalized so percentile latency queries don't compute a diff per row.
    durationMs: { type: Number, required: true, index: true },

    // ---- kind: "llm" specifics (null for other kinds) ----
    provider: { type: String, default: null }, // "openai" | "gemini"
    model: { type: String, default: null, index: true },

    // Prompt identity. promptId + promptVersion is the human-meaningful marker
    // you bump deliberately and reference in eval baselines. promptHash changes
    // on ANY edit — if version is unchanged but the hash moved, a baseline
    // comparison is silently invalid and this is how you detect it.
    promptId: { type: String, default: null, index: true },
    promptVersion: { type: Number, default: null },
    promptHash: { type: String, default: null },

    params: { type: Mixed, default: {} }, // { temperature, responseFormat, ... }
    finishReason: { type: String, default: null },

    usage: {
      inputTokens: { type: Number, default: null },
      outputTokens: { type: Number, default: null },
      totalTokens: { type: Number, default: null },
    },
    cost: {
      totalUsd: { type: Number, default: null },
      priceVersion: { type: String, default: null },
    },

    error: {
      name: { type: String, default: null },
      message: { type: String, default: null },
      providerCode: { type: String, default: null },
      httpStatus: { type: Number, default: null },
    },
    // Did the request fall back to another path AFTER this span failed?
    fallbackUsed: { type: Boolean, default: false },

    // Raw input/output live in AiSpanPayload (separate collection, TTL'd,
    // redacted in prod). This flag says whether that row exists.
    payloadStored: { type: Boolean, default: false },

    schemaVersion: { type: Number, default: 1 },
  },
  { _id: false, timestamps: true, minimize: false },
);

AiSpanSchema.index({ traceId: 1, startedAt: 1 });                  // reassemble a trace
AiSpanSchema.index({ model: 1, startedAt: -1 });                   // per-model latency/error
AiSpanSchema.index({ promptId: 1, promptVersion: 1, startedAt: -1 }); // per-prompt-version eval slices

export default mongoose.model("AiSpan", AiSpanSchema);
