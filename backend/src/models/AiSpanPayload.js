// backend/src/models/AiSpanPayload.js
//
// The big, sensitive half of a span: the actual prompt sent and text returned.
// Split out from AiSpan because:
//   1. it carries the user's real transaction data — it needs a retention limit,
//      and AiSpan (the long-lived analytical record) must not,
//   2. a TTL index here ages PII out automatically,
//   3. the hot analytical collection stays small — no multi-KB blobs bloating
//      the working set of every latency/cost query.
//
// _id === the span's _id. In production the content is redacted before write;
// in dev/eval it is stored raw (synthetic data, and you need it to debug).
import mongoose from "mongoose";

const { Mixed } = mongoose.Schema.Types;

const AiSpanPayloadSchema = new mongoose.Schema(
  {
    _id: { type: String }, // = spanId
    traceId: { type: String, required: true, index: true },

    input: { type: Mixed, default: null },
    output: { type: Mixed, default: null },
    redacted: { type: Boolean, default: false },

    // TTL. MongoDB drops the doc once now > expiresAt.
    expiresAt: { type: Date, required: true },
  },
  { _id: false, timestamps: true, minimize: false },
);

AiSpanPayloadSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("AiSpanPayload", AiSpanPayloadSchema);
