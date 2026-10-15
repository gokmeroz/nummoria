import mongoose from "mongoose";

// Shared, per-symbol cache of third-party analyst consensus (public data, not per-user).
// Freshness (24h) is decided in analystService via fetchedAt; the TTL index below only
// garbage-collects rows nobody has asked for in a month, so stale rows can still be
// served when the provider is down.
const AnalystConsensusSchema = new mongoose.Schema(
  {
    symbol: { type: String, required: true, unique: true },

    status: {
      type: String,
      enum: ["covered", "no_coverage"],
      required: true,
    },

    provider: { type: String, default: "fmp" },

    ratings: {
      strongBuy: { type: Number, default: 0 },
      buy: { type: Number, default: 0 },
      hold: { type: Number, default: 0 },
      sell: { type: Number, default: 0 },
      strongSell: { type: Number, default: 0 },
    },
    providerConsensus: { type: String, default: null },

    target: {
      high: { type: Number, default: null },
      low: { type: Number, default: null },
      mean: { type: Number, default: null },
      median: { type: Number, default: null },
    },

    fetchedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

AnalystConsensusSchema.index(
  { fetchedAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 },
);

export default mongoose.model("AnalystConsensus", AnalystConsensusSchema);
