const quotesEnabled = () =>
  String(process.env.ENABLE_QUOTES || "").toLowerCase() === "true";

export async function getQuote(req, res) {
  try {
    const symbol = String(req.query.symbol || "").trim();
    if (!symbol) return res.status(400).json({ error: "symbol is required" });

    if (!quotesEnabled()) {
      return res
        .status(400)
        .json({ error: "Quotes are disabled (ENABLE_QUOTES=false)" });
    }

    const mod = await import("yahoo-finance2");
    const yf = mod.default || mod;
    const q = await yf.quote(symbol); // direct pass-through of Yahoo's fields

    if (!q) return res.status(404).json({ error: "No data" });
    return res.json(q);
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Quote failed" });
  }
}
