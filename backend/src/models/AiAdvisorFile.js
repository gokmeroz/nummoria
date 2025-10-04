/* eslint-disable */
import mongoose from "mongoose";
const AiAdvisorFileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  fileName: String,
  contentText: String, // raw text from PDF
  parsedTransactions: { type: Array, default: [] },
  computedMetrics: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now },
});
export default mongoose.model("AiAdvisorFile", AiAdvisorFileSchema);
