import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeDate,
  detectDateOrder,
  fallbackDateOrder,
  detectStatementPeriod,
  inferPeriodFromDates,
  fitDateToPeriod,
  normalizeAmount,
  detectDecimalStyle,
  guessCategory,
  foldText,
} from "./statementNormalize.js";

test("dates: a part > 12 settles the order regardless of the document order", () => {
  assert.equal(normalizeDate("25/01/2025", "MDY"), "2025-01-25");
  assert.equal(normalizeDate("01/25/2025", "DMY"), "2025-01-25");
});

test("dates: ambiguous dates follow the document order", () => {
  assert.equal(normalizeDate("05/01/2025", "DMY"), "2025-01-05");
  assert.equal(normalizeDate("05/01/2025", "MDY"), "2025-05-01");
  assert.equal(normalizeDate("05.01.2025", "DMY"), "2025-01-05");
});

test("dates: ISO dates are read as-is; 2-digit years are 20YY", () => {
  assert.equal(normalizeDate("2025-03-09", "DMY"), "2025-03-09");
  assert.equal(normalizeDate("31.12.24", "DMY"), "2024-12-31");
});

test("dates: impossible calendar dates are null, never an invalid ISO string", () => {
  assert.equal(normalizeDate("31/02/2025", "DMY"), null);
  assert.equal(normalizeDate("02/30/2025", "MDY"), null);
  assert.equal(normalizeDate("2025-13-01"), null);
  assert.equal(normalizeDate("29.02.2023", "DMY"), null);
  assert.equal(normalizeDate("29.02.2024", "DMY"), "2024-02-29");
  assert.equal(normalizeDate("not a date"), null);
});

test("date order: decided only by unambiguous dates; contradicting evidence gives null", () => {
  assert.equal(detectDateOrder(["05/01/2025", "25/01/2025"]).order, "DMY");
  assert.equal(detectDateOrder(["05/01/2025", "01/25/2025"]).order, "MDY");
  assert.equal(detectDateOrder(["05/01/2025", "06/02/2025"]).order, null);
  assert.deepEqual(detectDateOrder(["25/01/2025", "01/25/2025"]), { order: null, evidence: "contradicting" });
});

test("date order fallback policy: '.' is day-first, '/' is month-first", () => {
  assert.equal(fallbackDateOrder(["05.01.2025"]), "DMY");
  assert.equal(fallbackDateOrder(["05/01/2025"]), "MDY");
});

test("period: ISO header is trusted; otherwise inferred from >= 3 unambiguous dates", () => {
  assert.deepEqual(detectStatementPeriod(["Period: 2025-01-01 to 2025-03-31"]), {
    start: "2025-01-01",
    end: "2025-03-31",
    source: "header",
  });
  assert.equal(inferPeriodFromDates(["05/01/2025", "06/02/2025"]), null);
  assert.deepEqual(inferPeriodFromDates(["15/01/2025", "05/02/2025", "28/02/2025", "13/03/2025"]), {
    start: "2025-01-15",
    end: "2025-03-13",
    source: "inferred",
  });
});

test("period fit repairs a per-row swap only when the other reading is inside the period", () => {
  const period = { start: "2025-01-01", end: "2025-03-31" };
  // DMY doc, row written month-first: 02.05 read as 2 May (outside) -> 5 Feb
  assert.deepEqual(fitDateToPeriod("02.05.2025", "DMY", period), { date: "2025-02-05", repaired: true });
  // both readings inside: kept as read
  assert.deepEqual(fitDateToPeriod("02.03.2025", "DMY", period), { date: "2025-03-02", repaired: false });
});

test("period fit across a year boundary", () => {
  const period = { start: "2024-12-15", end: "2025-01-14" };
  assert.equal(fitDateToPeriod("01/12/2025", "DMY", period).date, "2025-01-12");
  assert.equal(fitDateToPeriod("12/20/2024", "DMY", period).date, "2024-12-20");
});

test("amounts: dot and comma decimal conventions, with thousands separators", () => {
  assert.equal(normalizeAmount("1,234.56"), 1234.56);
  assert.equal(normalizeAmount("1.234,56"), 1234.56);
  assert.equal(normalizeAmount("-1.234,56"), -1234.56);
  assert.equal(normalizeAmount("12,50"), 12.5);
  assert.equal(normalizeAmount("1.234.567,00"), 1234567);
});

test("amounts: a lone 3-digit group is thousands unless the document uses that mark as decimal", () => {
  assert.equal(normalizeAmount("1,234"), 1234);
  assert.equal(normalizeAmount("1.234", "comma"), 1234);
  assert.equal(normalizeAmount("1.234", "dot"), 1.234);
});

test("amounts: negative conventions — leading minus, parentheses, trailing minus, DR; CR is positive", () => {
  assert.equal(normalizeAmount("-45.00"), -45);
  assert.equal(normalizeAmount("(45.00)"), -45);
  assert.equal(normalizeAmount("45.00-"), -45);
  assert.equal(normalizeAmount("45.00 DR"), -45);
  assert.equal(normalizeAmount("45.00 CR"), 45);
  assert.equal(normalizeAmount("$1,200.00"), 1200);
});

test("amounts: non-numbers are NaN, not 0", () => {
  assert.ok(Number.isNaN(normalizeAmount("")));
  assert.ok(Number.isNaN(normalizeAmount("abc")));
  assert.ok(Number.isNaN(normalizeAmount(null)));
});

test("decimal style is detected from 2-fraction-digit amounts", () => {
  assert.equal(detectDecimalStyle(["-58,90", "1.284,35", "42,00"]), "comma");
  assert.equal(detectDecimalStyle(["-58.90", "1,284.35"]), "dot");
  assert.equal(detectDecimalStyle(["100", "200"]), null);
});

test("Turkish text folds to ASCII so keyword rules apply", () => {
  assert.equal(foldText("MAAŞ ÖDEMESİ"), "maas odemesi");
  assert.equal(foldText("DOĞALGAZ FATURASI"), "dogalgaz faturasi");
});

test("categories: Turkish suffixes still match their stem", () => {
  assert.equal(guessCategory("MAAŞ ÖDEMESİ"), "Salary");
  assert.equal(guessCategory("KİRA ÖDEMESİ"), "Rent");
  assert.equal(guessCategory("DOGALGAZ FATURASI"), "Utilities");
});

test("categories: short keywords no longer match inside other words", () => {
  assert.equal(guessCategory("BARBER SHOP"), "Other"); // "bar"
  assert.equal(guessCategory("TELEFON"), "Other"); // "fon"
  assert.equal(guessCategory("BETHESDA CLINIC"), "Other"); // "eth"
  assert.equal(guessCategory("LAS VEGAS HOTEL"), "Other"); // "gas"
  assert.equal(guessCategory("SPORTS BAR"), "Dining");
});

test("categories: a gas STATION is fuel, plain gas is a utility bill", () => {
  assert.equal(guessCategory("SHELL GAS STATION"), "Transport");
  assert.equal(guessCategory("CITY GAS BILL"), "Utilities");
});

test("categories: unknown merchants are 'Other', never a guess", () => {
  assert.equal(guessCategory("ZYNTRIX LABS"), "Other");
  assert.equal(guessCategory(""), "Other");
});
