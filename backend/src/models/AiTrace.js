// backend/src/models/AiTrace.js
//
// One row per user-facing AI request (one advisor chat message, one document
// ingest). Write-once: created at request start as "running", updated exactly
// once at request end with rollups + final status. Outcomes that arrive later
// (user feedback, eval scores) hold a foreign key to THIS doc — a trace never
// points out at mutable things.
import mongoose from "mongoose";

const { ObjectId, Mixed } = mongoose.Schema.Types;

const AiTraceSchema = new mongoose.Schema(
  {
    // Application-generated id (UUID). Also returned to the client as the
    // X-Trace-Id response header so a support report can be tied to a row.
    _id: { type: String },

    userId: { type: ObjectId, ref: "User", default: null, index: true },
    // Correlates to the HTTP access log (app.js sets req.id + X-Request-Id).
    requestId: { type: String, default: null },

    // Coarse classification. Keep it a dotted string, not an enum, so new
    // surfaces don't need a migration.
    operation: { type: String, required: true, index: true },

    // Hard partition between real traffic and everything else. Every dashboard
    // query filters on env; eval runs must never move a production metric.
    env: {
      type: String,
      enum: ["production", "development", "test"],
      required: true,
      index: true,
    },
    // Orthogonal to env: an eval run can execute in the production env.
    source: {
      type: String,
      enum: ["live", "eval", "replay"],
      default: "live",
      index: true,
    },

    status: {
      type: String,
      enum: ["running", "ok", "error", "partial"],
      default: "running",
      index: true,
    },

    startedAt: { type: Date, required: true, default: () => new Date(), index: true },
    endedAt: { type: Date, default: null },
    durationMs: { type: Number, default: null },

    // Rollups, summed from spans at finalize().
    spanCount: { type: Number, default: 0 },
    llmCallCount: { type: Number, default: 0 },
    usage: {
      inputTokens: { type: Number, default: 0 },
      outputTokens: { type: Number, default: 0 },
      totalTokens: { type: Number, default: 0 },
    },
    // Frozen at write time against a versioned price table (see pricing.js).
    // Storing the number, not recomputing from a mutable price list, keeps
    // historical cost comparisons reproducible.
    costUsd: { type: Number, default: 0 },
    priceVersion: { type: String, default: null },

    // True when the request fell back to a non-primary path (rule-based reply,
    // second provider). The single most useful "something degraded" filter.
    fallbackUsed: { type: Boolean, default: false },

    // Small, non-PII request context: { subscription, tone, route, hasFile }.
    attributes: { type: Mixed, default: {} },

    schemaVersion: { type: Number, default: 1 },
  },
  { _id: false, timestamps: true, minimize: false },
);

// Query patterns this store must serve:
AiTraceSchema.index({ userId: 1, startedAt: -1 });            // "this user's requests"
AiTraceSchema.index({ operation: 1, env: 1, startedAt: -1 }); // "advisor chats today"
AiTraceSchema.index({ env: 1, status: 1, startedAt: -1 });    // "error rate last 24h"

export default mongoose.model("AiTrace", AiTraceSchema);
