import {
  analystService,
  normalizeSymbols,
  toView,
  DISCLAIMER,
} from "../services/analystService.js";
import { getLiveQuotesBulk } from "../services/quoteService.js";

/**
 * GET /investments/analyst?symbols=AAPL,MSFT
 */
export async function getAnalystConsensus(req, res) {
  const { symbols, error } = normalizeSymbols(req.query.symbols);
  if (error) return res.status(400).json({ error });

  try {
    const [results, quotes] = await Promise.all([
      analystService.getMany(symbols),
      // Quotes only feed upside %; analyst data is still useful without them.
      getLiveQuotesBulk(symbols).catch(() => ({})),
    ]);

    const items = {};
    for (const symbol of symbols) {
      const { doc, stale } = results.get(symbol);
      items[symbol] = toView(doc, quotes[symbol], { stale });
    }

    return res.json({ disclaimer: DISCLAIMER, items });
  } catch (e) {
    console.error("[ANALYST] failed:", { symbols, message: e?.message });
    return res
      .status(502)
      .json({ error: "Analyst data is temporarily unavailable." });
  }
}
