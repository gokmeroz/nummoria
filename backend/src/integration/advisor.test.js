// The advisor reads uploaded statements (AiAdvisorFile) and the ledger.
// Both must be scoped to the caller. Runs with no model keys, so replies
// come from the deterministic rule-based engine — these tests check data
// scope, not answer quality.
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { dbSuiteOptions, connectTestDb, disconnectTestDb, startApp, makeUserWithAccount, api, fileForm } from "../test/helpers.js";

const ALICE_CSV = "Date,Description,Amount\n05/02/2025,ZYNTRIX SECRET CLINIC,-950.00\n05/13/2025,ACME CORP PAYROLL,2500.00";
const QUESTION = { message: "What were my largest expenses?", tonePreference: "formal" };

describe("advisor data scope", dbSuiteOptions(), () => {
  let app, A, B, asA, asB, fileIdA, AiAdvisorFile;

  before(async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    await connectTestDb("advisor");
    ({ default: AiAdvisorFile } = await import("../models/AiAdvisorFile.js"));
    app = await startApp();
    A = await makeUserWithAccount("alice");
    B = await makeUserWithAccount("bob");
    asA = api(app.baseUrl, A.token);
    asB = api(app.baseUrl, B.token);
  });

  after(async () => {
    await app?.close();
    await disconnectTestDb();
  });

  test("upload stores parsed rows (with categories) under the uploader only", async () => {
    const r = await asA("POST", "/ai/financial-helper/ingest", { form: fileForm("s.csv", ALICE_CSV, "text/csv") });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    fileIdA = r.data.fileId;
    const doc = await AiAdvisorFile.findById(fileIdA).lean();
    assert.equal(String(doc.userId), String(A.user._id));
    assert.equal(doc.parsedTransactions.find((t) => t.amount > 0).category, "Salary");
    assert.equal(doc.computedMetrics.txCount, 2);
  });

  test("positive control: A asking about A's file sees A's data", async () => {
    const r = await asA("POST", "/ai/financial-helper/chat", { json: { ...QUESTION, fileId: fileIdA } });
    assert.equal(r.status, 200);
    assert.match(r.data.reply, /ZYNTRIX SECRET CLINIC/);
  });

  for (const route of ["/ai/financial-helper/chat", "/ai/financial-helper/ai/advisor"]) {
    test(`${route}: B passing A's fileId gets none of A's data`, async () => {
      const r = await asB("POST", route, { json: { ...QUESTION, fileId: fileIdA } });
      assert.equal(r.status, 200, JSON.stringify(r.data));
      assert.doesNotMatch(r.data.reply, /ZYNTRIX|950/);
    });
  }

  test("a malformed fileId is not a 500", async () => {
    const r = await asB("POST", "/ai/financial-helper/chat", { json: { ...QUESTION, fileId: "../../etc" } });
    assert.equal(r.status, 200);
  });

  test("ledger context is the caller's posted rows only", async () => {
    const { buildContextFromUserTransactions } = await import("../controllers/financialHelperController.js");
    const { Transaction } = await import("../models/transaction.js");
    const base = { currency: "USD", type: "expense", amountMinor: 1000, date: new Date("2025-01-10T00:00:00Z") };
    await Transaction.create([
      { ...base, userId: A.user._id, accountId: A.account._id, description: "ALICE ROW" },
      { ...base, userId: A.user._id, accountId: A.account._id, description: "ALICE DELETED", isDeleted: true },
      { ...base, userId: B.user._id, accountId: B.account._id, description: "BOB ROW" },
    ]);
    const ctx = await buildContextFromUserTransactions(A.user._id);
    assert.deepEqual(
      ctx.parsedTransactions.map((t) => t.description),
      ["ALICE ROW"],
    );
    assert.equal(ctx.computedMetrics.currency, "USD");
  });
});
