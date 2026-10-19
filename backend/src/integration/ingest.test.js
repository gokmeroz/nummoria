// Statement import into the ledger: auth, ownership, currency, and
// idempotency under retries, partial failures and concurrent double-submits.
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { jsPDF } from "jspdf";
import { dbSuiteOptions, connectTestDb, disconnectTestDb, startApp, makeUserWithAccount, api, fileForm } from "../test/helpers.js";

const CSV = [
  "Date,Description,Amount",
  "05/02/2025,METRO TRANSIT FARE,-2.90",
  "05/02/2025,METRO TRANSIT FARE,-2.90",
  "05/02/2025,METRO TRANSIT FARE,-2.90",
  "05/03/2025,LOCAL CAFE,-4.50",
  "05/13/2025,ACME CORP PAYROLL,2500.00",
].join("\n");
const csvForm = (content = CSV) => fileForm("statement.csv", content, "text/csv");

describe("ledger import (/ingest/csv, /ingest/pdf)", dbSuiteOptions(), () => {
  let app, A, B, asA, Transaction, Category, importRowKeys;

  before(async () => {
    await connectTestDb("ingest");
    ({ Transaction } = await import("../models/transaction.js"));
    ({ Category } = await import("../models/category.js"));
    ({ importRowKeys } = await import("../controllers/ingestController.js"));
    // Production runs with autoIndex off: the import must create the unique
    // index it relies on itself.
    await Transaction.collection.dropIndex("userId_1_importId_1_importRowKey_1");
    app = await startApp();
    A = await makeUserWithAccount("alice");
    B = await makeUserWithAccount("bob");
    asA = api(app.baseUrl, A.token);
  });

  after(async () => {
    await app?.close();
    await disconnectTestDb();
  });

  const rowsIn = (accountId) => Transaction.countDocuments({ accountId });

  test("anonymous upload is rejected before anything is written", async () => {
    const r = await api(app.baseUrl)("POST", `/ingest/csv?accountId=${B.account._id}`, { form: csvForm() });
    assert.equal(r.status, 401);
    assert.equal(await rowsIn(B.account._id), 0);
  });

  test("an account is required", async () => {
    const r = await asA("POST", "/ingest/csv", { form: csvForm() });
    assert.equal(r.status, 400);
    assert.equal(r.data.code, "ACCOUNT_REQUIRED");
  });

  test("A cannot import into B's account or with B's category", async () => {
    const r = await asA("POST", `/ingest/csv?accountId=${B.account._id}`, { form: csvForm() });
    assert.equal(r.status, 404);
    assert.equal(await rowsIn(B.account._id), 0);
    const catB = await Category.create({ userId: B.user._id, name: "Groceries", kind: "expense" });
    const r2 = await asA("POST", `/ingest/csv?accountId=${A.account._id}&categoryId=${catB._id}`, { form: csvForm() });
    assert.equal(r2.status, 404);
    assert.equal(await rowsIn(A.account._id), 0);
  });

  test("import books every row — including legitimate repeats — as A's, in the account's currency", async () => {
    const r = await asA("POST", `/ingest/csv?accountId=${A.account._id}`, { form: csvForm() });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.inserted, 5);
    const rows = await Transaction.find({ accountId: A.account._id }).lean();
    assert.equal(rows.length, 5);
    assert.ok(rows.every((t) => String(t.userId) === String(A.user._id) && t.currency === "USD"));
    assert.equal(rows.filter((t) => t.description === "METRO TRANSIT FARE").length, 3);
    const pay = rows.find((t) => t.type === "income");
    assert.equal(pay.amountMinor, 250000);
    assert.equal(pay.date.toISOString(), "2025-05-13T00:00:00.000Z");
  });

  test("re-uploading the same file adds nothing", async () => {
    const r = await asA("POST", `/ingest/csv?accountId=${A.account._id}`, { form: csvForm() });
    assert.equal(r.status, 200);
    assert.deepEqual([r.data.inserted, r.data.duplicates], [0, 5]);
    assert.equal(await rowsIn(A.account._id), 5);
  });

  test("retry after a partial failure inserts only the missing rows", async () => {
    const { Account } = await import("../models/account.js");
    const acct2 = await Account.create({ userId: A.user._id, name: "alice savings", currency: "USD" });
    // Simulate an attempt that died after writing the first 2 rows.
    const docs = [
      { date: "2025-05-02", amountMinor: 290, type: "expense", description: "METRO TRANSIT FARE" },
      { date: "2025-05-02", amountMinor: 290, type: "expense", description: "METRO TRANSIT FARE" },
      { date: "2025-05-02", amountMinor: 290, type: "expense", description: "METRO TRANSIT FARE" },
      { date: "2025-05-03", amountMinor: 450, type: "expense", description: "LOCAL CAFE" },
      { date: "2025-05-13", amountMinor: 250000, type: "income", description: "ACME CORP PAYROLL" },
    ];
    const keys = importRowKeys(docs);
    const importId = crypto.createHash("sha256").update(`${A.user._id}:${acct2._id}:`).update(Buffer.from(CSV)).digest("hex");
    await Transaction.insertMany(
      docs.slice(0, 2).map((d, i) => ({
        ...d,
        userId: A.user._id,
        accountId: acct2._id,
        currency: "USD",
        date: new Date(`${d.date}T00:00:00Z`),
        importId,
        importRowKey: keys[i],
      })),
    );
    const r = await asA("POST", `/ingest/csv?accountId=${acct2._id}`, { form: csvForm() });
    assert.deepEqual([r.data.inserted, r.data.duplicates], [3, 2]);
    assert.equal(await rowsIn(acct2._id), 5);
  });

  test("two simultaneous uploads of the same file book each row once", async () => {
    const { account, token } = await makeUserWithAccount("carol");
    const asOwner = api(app.baseUrl, token);
    const [r1, r2] = await Promise.all([
      asOwner("POST", `/ingest/csv?accountId=${account._id}`, { form: csvForm() }),
      asOwner("POST", `/ingest/csv?accountId=${account._id}`, { form: csvForm() }),
    ]);
    assert.deepEqual([r1.status, r2.status], [200, 200]);
    assert.equal(r1.data.inserted + r2.data.inserted, 5);
    assert.equal(await rowsIn(account._id), 5);
  });

  test("rows in another currency are skipped, not booked into a USD account", async () => {
    const { account, token } = await makeUserWithAccount("dave");
    const r = await api(app.baseUrl, token)("POST", `/ingest/csv?accountId=${account._id}`, {
      form: csvForm("Date,Description,Amount,Currency\n01/15/2025,PARIS CAFE,-4.00,EUR\n01/16/2025,NY CAFE,-5.00,USD"),
    });
    assert.equal(r.data.inserted, 1);
    assert.equal(r.data.skippedReasons.currencyMismatch, 1);
  });

  test("a category is applied only to rows of its kind", async () => {
    const { account, token, user } = await makeUserWithAccount("erin");
    const cat = await Category.create({ userId: user._id, name: "Groceries", kind: "expense" });
    await api(app.baseUrl, token)("POST", `/ingest/csv?accountId=${account._id}&categoryId=${cat._id}`, { form: csvForm() });
    const rows = await Transaction.find({ accountId: account._id }).lean();
    assert.ok(rows.filter((t) => t.type === "expense").every((t) => String(t.categoryId) === String(cat._id)));
    assert.ok(rows.filter((t) => t.type === "income").every((t) => t.categoryId == null));
  });

  test("a text-layer PDF (generated, not scanned) imports through pdf-parse", async () => {
    const { account, token } = await makeUserWithAccount("frank");
    const doc = new jsPDF();
    doc.setFont("courier");
    ["Example Bank — Statement", "Date        Description        Amount", "01/14/2025  CITY WATER BILL  -41.30", "01/20/2025  ACME PAYROLL  2500.00"].forEach(
      (l, i) => doc.text(l, 10, 10 + i * 6),
    );
    const pdf = Buffer.from(doc.output("arraybuffer"));
    const r = await api(app.baseUrl, token)("POST", `/ingest/pdf?accountId=${account._id}`, {
      form: fileForm("statement.pdf", pdf, "application/pdf"),
    });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.inserted, 2);
    const rows = await Transaction.find({ accountId: account._id }).sort({ date: 1 }).lean();
    assert.deepEqual(
      rows.map((t) => [t.date.toISOString().slice(0, 10), t.type, t.amountMinor, t.description]),
      [
        ["2025-01-14", "expense", 4130, "CITY WATER BILL"],
        ["2025-01-20", "income", 250000, "ACME PAYROLL"],
      ],
    );
  });

  test("a file with no transactions is a 400, nothing written", async () => {
    const { account, token } = await makeUserWithAccount("gina");
    const r = await api(app.baseUrl, token)("POST", `/ingest/csv?accountId=${account._id}`, { form: csvForm("hello,world\n1,2") });
    assert.equal(r.status, 400);
    assert.equal(await rowsIn(account._id), 0);
  });
});
