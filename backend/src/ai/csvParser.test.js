import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsvStatement } from "./csvParser.js";

const fin = (rows) => rows.map(({ date, amount, description }) => ({ date, amount, description }));

test("semicolon-delimited export with comma decimals (the case the old eval parser read as 0 rows)", () => {
  const { rows, meta } = parseCsvStatement("Tarih;Açıklama;Tutar\n01.01.2025;\"KIRA ODEMESI\";-1908,60\n15.01.2025;MAAS;5000,00");
  assert.equal(meta.delimiter, ";");
  assert.deepEqual(fin(rows), [
    { date: "2025-01-01", amount: -1908.6, description: "KIRA ODEMESI" },
    { date: "2025-01-15", amount: 5000, description: "MAAS" },
  ]);
  assert.equal(rows[0].category, "Rent");
});

test("Credit/Debit columns (unsupported by the previous upload parser) become signed amounts", () => {
  const { rows } = parseCsvStatement("Date,Description,Credit Amount,Debit Amount\n01/02/2025,PAYROLL,2500.00,\n01/13/2025,KROGER,,54.20");
  assert.deepEqual(
    rows.map((r) => r.amount),
    [2500, -54.2],
  );
});

test("BOM, preamble lines and a quoted comma in the description", () => {
  const csv = [
    "﻿Account Name:,Everyday Checking",
    "Account Number:,XXXX1234",
    "",
    "Date,Description,Debit,Credit,Balance",
    '06/02/2025,"SAFEWAY GROCERY, STORE 1123",54.20,,1945.80',
    "06/18/2025,PAYROLL,,2500.00,4445.80",
  ].join("\n");
  const { rows, meta } = parseCsvStatement(csv);
  assert.equal(meta.headerLine, 4);
  assert.deepEqual(fin(rows), [
    { date: "2025-06-02", amount: -54.2, description: "SAFEWAY GROCERY, STORE 1123" },
    { date: "2025-06-18", amount: 2500, description: "PAYROLL" },
  ]);
  assert.equal(rows[0].line, 5);
});

test("Turkish column names with dotted/dotless i, thousands separators, balance ignored", () => {
  const { rows } = parseCsvStatement("İşlem Tarihi;İşlem Açıklaması;İşlem Tutarı;Bakiye\n14.03.2025;A101 MARKET;-1.032,85;28.467,15");
  assert.deepEqual(fin(rows), [{ date: "2025-03-14", amount: -1032.85, description: "A101 MARKET" }]);
});

test("blank rows, an impossible date and a dateless TOTAL row are skipped with reasons", () => {
  const { rows, skippedReasons } = parseCsvStatement(
    "Date,Description,Amount\n07/01/2025,PAY,2500.00\n\n02/30/2025,BROKEN,-9.99\n07/15/2025,,-3.00\n,TOTAL,2490.01",
  );
  assert.deepEqual(fin(rows), [
    { date: "2025-07-01", amount: 2500, description: "PAY" },
    { date: "2025-07-15", amount: -3, description: "" },
  ]);
  assert.deepEqual(skippedReasons, { invalidDate: 1, invalidAmount: 0, missingDate: 1 });
});

test("non-numeric amount is skipped, not booked as 0", () => {
  const { rows, skippedReasons } = parseCsvStatement("Date,Description,Amount\n01/15/2025,X,n/a\n01/16/2025,Y,-1.00");
  assert.equal(rows.length, 1);
  assert.equal(skippedReasons.invalidAmount, 1);
});

test("identical rows are all kept", () => {
  const { rows } = parseCsvStatement("Date,Description,Amount\n05/02/2025,METRO,-2.90\n05/02/2025,METRO,-2.90\n05/13/2025,PAY,1.00");
  assert.equal(rows.length, 3);
});

test("a per-row currency column is carried through", () => {
  const { rows } = parseCsvStatement("Date,Description,Amount,Currency\n01/15/2025,X,-1.00,eur");
  assert.equal(rows[0].currency, "EUR");
});

test("a file without a recognizable header yields no rows and says why", () => {
  const r = parseCsvStatement("foo,bar\n1,2");
  assert.deepEqual(r.rows, []);
  assert.equal(r.meta.error, "no-recognized-header");
  assert.equal(parseCsvStatement("").meta.error, "no-recognized-header");
});
