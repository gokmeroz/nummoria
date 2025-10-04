/* eslint-disable */
export function computeMetrics(txs = []) {
  if (!txs.length) return {};
  // group by month
  const byMonth = new Map();
  for (const t of txs) {
    const month = (t.date || "").slice(0, 7);
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month).push(t);
  }

  const months = [...byMonth.keys()].sort();
  const totals = months.map((m) => {
    const arr = byMonth.get(m);
    const income = arr
      .filter((x) => x.amount > 0)
      .reduce((a, b) => a + b.amount, 0);
    const expense = arr
      .filter((x) => x.amount < 0)
      .reduce((a, b) => a + b.amount, 0);
    return { month: m, income, expense, net: income + expense };
  });

  // savings rate = avg( (income+expense)/income ), expense negative
  const sr =
    totals
      .filter((t) => t.income > 0)
      .map((t) => t.net / t.income)
      .reduce((a, b) => a + b, 0) /
    Math.max(1, totals.filter((t) => t.income > 0).length);

  const last = totals[totals.length - 1] || { income: 0, expense: 0, net: 0 };
  const monthlyBurn = -Math.min(0, last.expense);

  // category breakdown (last 60 days)
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60);
  const last60 = txs.filter((t) => new Date(t.date) >= cutoff);
  const cat = {};
  for (const t of last60) {
    const key = t.category || "Other";
    cat[key] = (cat[key] || 0) + t.amount;
  }

  // simple income stability: stdev/mean of last N months income
  const incomes = totals.map((t) => t.income).filter((x) => x > 0);
  const meanI =
    incomes.reduce((a, b) => a + b, 0) / Math.max(1, incomes.length);
  const stdevI = Math.sqrt(
    incomes.map((x) => Math.pow(x - meanI, 2)).reduce((a, b) => a + b, 0) /
      Math.max(1, incomes.length)
  );
  const incomeStability = meanI ? 1 - Math.min(1, stdevI / meanI) : 0; // 0–1 higher is steadier

  // naive investment allocation from categories
  const invest = Object.entries(cat)
    .filter(([k]) => k === "Investments")
    .reduce((a, [, v]) => a + v, 0);
  const spend = Object.entries(cat)
    .filter(([k]) => k !== "Investments")
    .reduce((a, [, v]) => a + v, 0);
  const investmentAllocation = invest / Math.max(1, invest + Math.abs(spend));

  // basic risk score (0 risky – 100 safe)
  // heuristics: higher savings rate, stable income, lower burn => safer
  const savingsRate = Math.max(0, Math.min(1, sr));
  const burnFactor = 1 / (1 + Math.max(0, monthlyBurn)); // decreases with bigger burn
  const riskScore = Math.round(
    100 * (0.55 * savingsRate + 0.35 * incomeStability + 0.1 * burnFactor)
  );

  return {
    months: totals,
    savingsRate: Number((savingsRate * 100).toFixed(1)),
    monthlyBurn: Number(monthlyBurn.toFixed(2)),
    categoryBreakdown: cat,
    incomeStability: Number((incomeStability * 100).toFixed(1)),
    investmentAllocation: Number((investmentAllocation * 100).toFixed(1)),
    riskScore,
  };
}
