import { getLiveQuote } from "../services/quoteService.js";

export async function getQuote(req, res) {
  try {
    const symbol = String(req.query.symbol || "")
      .trim()
      .toUpperCase();

    if (!symbol) {
      return res.status(400).json({ error: "symbol is required" });
    }

    const q = await getLiveQuote(symbol);
    return res.json(q);
  } catch (e) {
    const status = e?.statusCode || 502;
    const message = e?.message || "Quote service is temporarily unavailable.";

    console.error("[MARKET/QUOTE] failed:", {
      symbol: req?.query?.symbol,
      status,
      message,
    });

    return res.status(status).json({ error: message });
  }
}
