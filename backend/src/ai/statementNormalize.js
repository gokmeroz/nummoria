// backend/src/ai/statementNormalize.js
//
// Field normalization shared by every statement parser (CSV and PDF text,
// ledger import and advisor upload). There used to be three copies of
// normalizeDate/normalizeAmount with different rules — the eval measured one,
// the upload routes ran another. One copy means the eval score is a statement
// about the code users actually hit.
//
// Contracts:
//   - dates come out as "YYYY-MM-DD" or null (never an invalid calendar date)
//   - amounts come out as signed MAJOR-unit numbers or NaN; conversion to
//     integer minor units happens at the persistence boundary (ingestController)
//   - categories are best-effort labels; they never change date/amount/description

// ISO first so "2025-01-15" is not read as "25-01-15".
export const DATE_RGX =
  /(?<![\d.\/-])(\d{4}-\d{2}-\d{2}|\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})(?![\d\/-]|\.\d)/;
export const DATE_RGX_ALL = new RegExp(DATE_RGX.source, "g");

/** "YYYY-MM-DD" only if y/m/d is a real calendar date. */
export function isoIfValid(y, m, d) {
  const yy = Number(y);
  const mm = Number(m);
  const dd = Number(d);
  if (!Number.isInteger(yy) || !Number.isInteger(mm) || !Number.isInteger(dd)) return null;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const dt = new Date(Date.UTC(yy, mm - 1, dd));
  if (dt.getUTCFullYear() !== yy || dt.getUTCMonth() !== mm - 1 || dt.getUTCDate() !== dd) {
    return null; // e.g. 31/02
  }
  return `${String(yy).padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

/** Split a raw date token into its numeric parts and separator. */
function dateParts(raw) {
  const s = String(raw || "").trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return { iso: true, y: iso[1], a: Number(iso[2]), b: Number(iso[3]) };
  const m = s.match(/^(\d{1,2})([\/.\-])(\d{1,2})\2(\d{2,4})$/);
  if (!m) return null;
  const year = m[4].length === 2 ? String(2000 + Number(m[4])) : m[4];
  if (m[4].length === 3) return null;
  return { iso: false, sep: m[2], a: Number(m[1]), b: Number(m[3]), y: year };
}

/**
 * Day/month order for a whole document. One date alone can't tell whether
 * 05/01 is May 1st or January 5th, but a statement uses one format
 * throughout, and any date with a part > 12 can only be read one way.
 * Returns { order: "DMY"|"MDY"|null, evidence } — null when the document has
 * no deciding date, or contradicting ones.
 */
export function detectDateOrder(rawDates) {
  let dayFirst = 0;
  let monthFirst = 0;
  for (const raw of rawDates) {
    const p = dateParts(raw);
    if (!p || p.iso) continue;
    if (p.a > 12 && p.b <= 12) dayFirst++;
    else if (p.b > 12 && p.a <= 12) monthFirst++;
  }
  if (dayFirst && !monthFirst) return { order: "DMY", evidence: "unambiguous-dates" };
  if (monthFirst && !dayFirst) return { order: "MDY", evidence: "unambiguous-dates" };
  return { order: null, evidence: dayFirst && monthFirst ? "contradicting" : "none" };
}

/**
 * Explicit uncertainty policy for a document whose dates never decide the
 * order: a "." separator is day-first in every locale that uses it (de, tr,
 * ru, ...); "/" and "-" are genuinely ambiguous, so we fall back to MDY (the
 * historical default here) and callers mark those dates low-confidence.
 */
export function fallbackDateOrder(rawDates) {
  for (const raw of rawDates) {
    const p = dateParts(raw);
    if (p && !p.iso) return p.sep === "." ? "DMY" : "MDY";
  }
  return "MDY";
}

/**
 * Normalize a raw date token. `order` only decides dates where both parts
 * are <= 12; a part > 12 always settles that date by itself.
 * Returns "YYYY-MM-DD" or null.
 */
export function normalizeDate(raw, order = null) {
  const p = dateParts(raw);
  if (!p) return null;
  if (p.iso) return isoIfValid(p.y, p.a, p.b);
  let d;
  let m;
  if (p.a > 12) [d, m] = [p.a, p.b];
  else if (p.b > 12) [d, m] = [p.b, p.a];
  else if (order === "DMY") [d, m] = [p.a, p.b];
  else [d, m] = [p.b, p.a];
  return isoIfValid(p.y, m, d);
}

/** Both readings of an ambiguous date (null where a reading is invalid). */
function bothReadings(raw) {
  return { dmy: normalizeDate(raw, "DMY"), mdy: normalizeDate(raw, "MDY") };
}

/** True when the date's day/month order matters (both parts <= 12, differ). */
export function isAmbiguousDate(raw) {
  const p = dateParts(raw);
  return Boolean(p && !p.iso && p.a <= 12 && p.b <= 12 && p.a !== p.b);
}

/**
 * Statement period from a header like "Period: 2025-01-01 to 2025-03-30".
 * Only ISO dates are trusted: they have no day/month ambiguity, so the
 * period can check the ambiguous transaction dates.
 */
export function detectStatementPeriod(lines) {
  for (const line of lines) {
    const m = line.match(/(\d{4}-\d{2}-\d{2})\s*(?:to|-|–|—)\s*(\d{4}-\d{2}-\d{2})/i);
    if (m && isoIfValid(...m[1].split("-")) && isoIfValid(...m[2].split("-")) && m[1] <= m[2]) {
      return { start: m[1], end: m[2], source: "header" };
    }
  }
  return null;
}

/**
 * Period inferred from the dates that can only be read one way (ISO, or a
 * part > 12). Used when the document has no period header (CSV exports).
 * Needs at least 3 such dates to be meaningful.
 */
export function inferPeriodFromDates(rawDates) {
  const certain = [];
  for (const raw of rawDates) {
    const p = dateParts(raw);
    if (!p) continue;
    if (p.iso || p.a > 12 || p.b > 12 || p.a === p.b) {
      const iso = normalizeDate(raw);
      if (iso) certain.push(iso);
    }
  }
  if (certain.length < 3) return null;
  certain.sort();
  return { start: certain[0], end: certain[certain.length - 1], source: "inferred" };
}

/**
 * Some statements swap DD/MM on individual rows, which a document-wide
 * order can't catch. If a row's date falls outside the statement period
 * and its other reading falls inside, the other reading is the row's date.
 * Dates where both readings fit stay as read.
 * Returns { date, repaired }.
 */
export function fitDateToPeriod(raw, order, period) {
  const date = normalizeDate(raw, order);
  if (!period || !isAmbiguousDate(raw)) return { date, repaired: false };
  if (date && date >= period.start && date <= period.end) return { date, repaired: false };
  const { dmy, mdy } = bothReadings(raw);
  const other = date === dmy ? mdy : dmy;
  if (other && other >= period.start && other <= period.end) return { date: other, repaired: true };
  return { date, repaired: false };
}

/**
 * Decimal style a document uses, from amounts with exactly two fraction
 * digits: "12,50" votes comma, "12.50" votes dot. Lets "1.234" (Turkish
 * thousands) and "1,234" (US thousands) be read correctly.
 */
export function detectDecimalStyle(rawAmounts) {
  let comma = 0;
  let dot = 0;
  for (const raw of rawAmounts) {
    const s = String(raw || "");
    if (/\d,\d{2}(?!\d)/.test(s) && !/\d\.\d{2}(?!\d)/.test(s.split(",").pop() || "")) {
      if (/,\d{2}\s*$|,\d{2}\D*$/.test(s)) comma++;
    }
    if (/\.\d{2}\s*$|\.\d{2}\D*$/.test(s)) dot++;
  }
  if (comma > dot) return "comma";
  if (dot > comma) return "dot";
  return null;
}

/**
 * Parse a monetary string to a signed major-unit number (NaN if it isn't one).
 * Handles: "-1.234,56", "1,234.56", "(45.00)", "45.00-", "45.00 CR"/"DR",
 * currency symbols/codes, NBSP/space thousands separators. `decimalStyle`
 * ("comma"|"dot"|null) decides "1.234" / "1,234" (thousands vs decimal).
 */
export function normalizeAmount(raw, decimalStyle = null) {
  if (raw == null) return NaN;
  let s = String(raw).trim();
  if (!s) return NaN;

  let sign = 1;
  if (/^\(.*\)$/.test(s)) sign = -1;
  if (/\bDR\.?$/i.test(s)) sign = -1;
  if (/^-|[\d)]\s*-$|−/.test(s)) sign = -1;
  // "CR" is a credit marker: positive, overriding nothing else.

  s = s.replace(/[^\d.,]/g, "");
  if (!/\d/.test(s)) return NaN;

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  let num;
  if (lastDot >= 0 && lastComma >= 0) {
    // Both present: whichever comes last is the decimal mark.
    num = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? "." : ",";
    const parts = s.split(sep);
    const frac = parts[parts.length - 1];
    const isThousands =
      parts.length > 2 || // "1.234.567"
      (frac.length === 3 &&
        parts[0].length >= 1 &&
        parts[0].length <= 3 &&
        decimalStyle !== (sep === "." ? "dot" : "comma"));
    num = isThousands ? parts.join("") : parts.slice(0, -1).join("") + "." + frac;
  } else {
    num = s;
  }
  const v = Number(num);
  return Number.isFinite(v) ? sign * Math.abs(v) : NaN;
}

/** Lowercase, strip diacritics, fold Turkish dotless i — "MAAŞ ÖDEMESİ" -> "maas odemesi". */
export function foldText(s) {
  return String(s || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/İ/g, "I")
    .toLowerCase();
}

// Keyword rules over folded text. Same keyword list as before; what changed
// is HOW each keyword matches, because a bare substring test made "bar"
// match BARBER, "fon" TELEFON, "eth" BETHESDA, "gas" VEGAS:
//   stem: must start a word, any suffix allowed — Turkish is agglutinative
//         ("fatura" must still match FATURASI, "kira" KIRASI)
//   word: must be the whole word — short tokens that occur inside others
//   sub:  anywhere (kept only where the old behavior relied on it: SUPERMARKET)
// The list is deliberately not extended with merchant names from the
// synthetic layouts; see docs/ai-roadmap/EVALUATION.md (in-sample tuning).
const rule = ({ stem = [], word = [], sub = [] }) =>
  new RegExp(
    [
      stem.length ? `\\b(?:${stem.join("|")})` : null,
      word.length ? `\\b(?:${word.join("|")})\\b` : null,
      sub.length ? `(?:${sub.join("|")})` : null,
    ]
      .filter(Boolean)
      .join("|"),
  );

const CATEGORY_RULES = [
  ["Salary", rule({ stem: ["salary", "payroll", "maas", "ucret"] })],
  ["Rent", rule({ stem: ["kira"], word: ["rent"] })],
  ["Groceries", rule({ stem: ["grocery", "migros", "carrefour"], word: ["bim", "a101"], sub: ["market"] })],
  ["Dining", rule({ stem: ["restaurant", "cafe", "yemek"], word: ["bar"] })],
  // Before Utilities: "gas" alone is natural gas (a bill), but a gas STATION
  // sells fuel. Found on the eval set (278 rows) — so the category score
  // gain from this rule is in-sample; see EVALUATION.md.
  ["Transport", rule({ stem: ["uber", "taxi", "taksi", "metro", "otobus", "gas station", "petrol station"], word: ["fuel"] })],
  [
    "Investments",
    rule({ stem: ["bitcoin", "binance", "borsa", "hisse"], word: ["btc", "eth", "avax", "bist", "etf", "fon"] }),
  ],
  ["Utilities", rule({ stem: ["electric", "internet", "fatura"], word: ["water", "gas", "bill", "bills"] })],
];

export const UNCATEGORIZED = "Other";

/** Best-effort category label; UNCATEGORIZED when no rule fires. */
export function guessCategory(desc = "") {
  const d = foldText(desc);
  for (const [category, rx] of CATEGORY_RULES) if (rx.test(d)) return category;
  return UNCATEGORIZED;
}
