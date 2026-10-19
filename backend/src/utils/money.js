// backend/src/utils/money.js
//
// Ledger amounts are integer MINOR units (cents, kuruş) plus a currency.
// The number of minor digits depends on the currency — dividing every
// amount by 100 is wrong for JPY (0) and KWD (3).

const ZERO_DECIMAL = new Set(["JPY", "KRW", "CLP", "VND"]);
const THREE_DECIMAL = new Set(["BHD", "IQD", "JOD", "KWD", "OMR", "TND"]);

export function decimalsForCurrency(code = "USD") {
  const c = String(code || "").toUpperCase();
  if (ZERO_DECIMAL.has(c)) return 0;
  if (THREE_DECIMAL.has(c)) return 3;
  return 2;
}

export function majorToMinor(major, currency = "USD") {
  return Math.round(Number(major) * 10 ** decimalsForCurrency(currency));
}

export function minorToMajor(minor, currency = "USD") {
  return Number(minor) / 10 ** decimalsForCurrency(currency);
}
