/* eslint-disable */
export function computeMetrics(txs = []) {
  if (!Array.isArray(txs) || !txs.length) {
    return {
      txCount: 0,
      months: [],
      categoryBreakdown: {},
      savingsRate: null,
      monthlyBurn: null,
      incomeStability: null,
      investmentAllocation: null,
      riskScore: null,
      dataFlags: {
        sparse: true,
        hasIncomeLast90: false,
        hasExpenseLast90: false,
      },
      firstDate: null,
      lastDate: null,
      daysCovered: 0,
      categoryWindowDays: 60,
    };
  }

  // Basic coverage
  const dates = txs
    .map((t) => new Date(t.date))
    .filter((d) => !isNaN(d))
    .sort((a, b) => a - b);
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];
  const daysCovered = Math.max(
    1,
    Math.round((lastDate - firstDate) / 86400000) + 1
  );

  // Group by month
  const byMonth = new Map();
  for (const t of txs) {
    const m = (t.date || "").slice(0, 7);
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m).push(t);
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

  // Savings rate: avg(net/income) for months with income
  const incomeMonths = totals.filter((t) => t.income > 0);
  const srRaw =
    incomeMonths.reduce((acc, t) => acc + t.net / t.income, 0) /
    Math.max(1, incomeMonths.length);

  // "last month" burn — if last month has no expenses, fall back to last 30d
  let monthlyBurn = 0;
  const last = totals[totals.length - 1] || { expense: 0 };
  if (last.expense < 0) {
    monthlyBurn = -last.expense;
  } else {
    const cutoff30 = new Date(lastDate);
    cutoff30.setDate(cutoff30.getDate() - 30);
    const last30 = txs.filter((t) => new Date(t.date) >= cutoff30);
    const exp30 = last30
      .filter((x) => x.amount < 0)
      .reduce((a, b) => a + b.amount, 0);
    monthlyBurn = -Math.min(0, exp30);
  }

  // Category breakdown: prefer last 60d; if empty, use all-time
  const catWindowDays = 60;
  const cutoff = new Date(lastDate);
  cutoff.setDate(cutoff.getDate() - catWindowDays);
  const lastWin = txs.filter((t) => new Date(t.date) >= cutoff);
  const catWindow = lastWin.length ? lastWin : txs;
  const categoryBreakdown = {};
  for (const t of catWindow) {
    const key = t.category || "Other";
    categoryBreakdown[key] = (categoryBreakdown[key] || 0) + t.amount;
  }

  // Simple income stability (0–1, higher steadier)
  const incomes = totals.map((t) => t.income).filter((x) => x > 0);
  const meanI =
    incomes.reduce((a, b) => a + b, 0) / Math.max(1, incomes.length);
  const stdevI = Math.sqrt(
    incomes.map((x) => Math.pow(x - meanI, 2)).reduce((a, b) => a + b, 0) /
      Math.max(1, incomes.length)
  );
  const incomeStabilityRaw = meanI ? 1 - Math.min(1, stdevI / meanI) : 0;

  // Naive investment allocation (from categories)
  const invest = Object.entries(categoryBreakdown)
    .filter(([k]) => /invest/i.test(k))
    .reduce((a, [, v]) => a + v, 0);
  const spend = Object.entries(categoryBreakdown)
    .filter(([k]) => !/invest/i.test(k))
    .reduce((a, [, v]) => a + v, 0);
  const invAllocRaw = invest / Math.max(1, invest + Math.abs(spend));

  // Risk score (0 risky – 100 safe)
  const savingsRate = Math.max(0, Math.min(1, srRaw));
  const burnFactor = 1 / (1 + Math.max(0, monthlyBurn));
  const incomeStability = Math.max(0, Math.min(1, incomeStabilityRaw));
  const riskScore = Math.round(
    100 * (0.55 * savingsRate + 0.35 * incomeStability + 0.1 * burnFactor)
  );

  // Data flags
  const cutoff90 = new Date(lastDate);
  cutoff90.setDate(cutoff90.getDate() - 90);
  const last90 = txs.filter((t) => new Date(t.date) >= cutoff90);
  const hasIncomeLast90 = last90.some((t) => t.amount > 0);
  const hasExpenseLast90 = last90.some((t) => t.amount < 0);
  const sparse =
    txs.length < 10 ||
    daysCovered < 45 ||
    !hasExpenseLast90 ||
    !hasIncomeLast90;

  return {
    txCount: txs.length,
    months: totals,
    savingsRate: Number((savingsRate * 100).toFixed(1)),
    monthlyBurn: Number(monthlyBurn.toFixed(2)),
    categoryBreakdown,
    categoryWindowDays: catWindow === lastWin ? catWindowDays : "all",
    incomeStability: Number((incomeStability * 100).toFixed(1)),
    investmentAllocation: Number((invAllocRaw * 100).toFixed(1)),
    riskScore,
    dataFlags: { sparse, hasIncomeLast90, hasExpenseLast90 },
    firstDate: firstDate?.toISOString?.()?.slice(0, 10) || null,
    lastDate: lastDate?.toISOString?.()?.slice(0, 10) || null,
    daysCovered,
  };
}
