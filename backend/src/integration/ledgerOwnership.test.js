// User A must not be able to read, change or delete User B's ledger rows,
// nor book into B's account or category. Runs the real app over HTTP.
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { dbSuiteOptions, connectTestDb, disconnectTestDb, startApp, makeUserWithAccount, api } from "../test/helpers.js";

describe("ledger ownership boundaries", dbSuiteOptions(), () => {
  let app, A, B, asA, txB, catB, Transaction, Account, Category;

  before(async () => {
    await connectTestDb("ownership");
    ({ Transaction } = await import("../models/transaction.js"));
    ({ Account } = await import("../models/account.js"));
    ({ Category } = await import("../models/category.js"));
    app = await startApp();
    A = await makeUserWithAccount("alice", { balance: 100000 });
    B = await makeUserWithAccount("bob", { balance: 500000 });
    asA = api(app.baseUrl, A.token);
    catB = await Category.create({ userId: B.user._id, name: "Groceries", kind: "expense" });
    const asB = api(app.baseUrl, B.token);
    const created = await asB("POST", "/transactions", {
      json: { accountId: String(B.account._id), type: "expense", amountMinor: 4200, currency: "USD", date: "2025-01-10", description: "BOB PRIVATE" },
    });
    assert.equal(created.status, 201, JSON.stringify(created.data));
    txB = created.data.created[0];
  });

  after(async () => {
    await app?.close();
    await disconnectTestDb();
  });

  const bobRowUnchanged = async () => {
    const row = await Transaction.findById(txB._id).lean();
    assert.equal(row.isDeleted, false);
    assert.equal(row.amountMinor, 4200);
    assert.equal(row.description, "BOB PRIVATE");
    assert.equal((await Account.findById(B.account._id).lean()).balance, 500000 - 4200);
  };

  test("unauthenticated requests are rejected", async () => {
    const r = await api(app.baseUrl)("GET", "/transactions");
    assert.equal(r.status, 401);
  });

  test("A's list never contains B's rows", async () => {
    const r = await asA("GET", "/transactions");
    assert.equal(r.status, 200);
    assert.ok(!r.data.some((t) => t._id === txB._id));
  });

  test("A cannot read B's row by id (404, same as not found)", async () => {
    assert.equal((await asA("GET", `/transactions/${txB._id}`)).status, 404);
  });

  test("A cannot modify B's row", async () => {
    const r = await asA("PUT", `/transactions/${txB._id}`, { json: { amountMinor: 1, description: "pwned" } });
    assert.equal(r.status, 404);
    await bobRowUnchanged();
  });

  test("A cannot soft- or hard-delete B's row", async () => {
    assert.equal((await asA("DELETE", `/transactions/${txB._id}`)).status, 404);
    assert.equal((await asA("DELETE", `/transactions/${txB._id}/hard`)).status, 404);
    await bobRowUnchanged();
  });

  test("A cannot book into B's account; B's balance is untouched", async () => {
    const before = await Transaction.countDocuments({ accountId: B.account._id });
    const r = await asA("POST", "/transactions", {
      json: { accountId: String(B.account._id), type: "expense", amountMinor: 999, currency: "USD", date: "2025-01-11" },
    });
    assert.equal(r.status, 400);
    assert.match(r.data.error, /Account not found/);
    assert.equal(await Transaction.countDocuments({ accountId: B.account._id }), before);
    await bobRowUnchanged();
  });

  test("A cannot use B's category", async () => {
    const r = await asA("POST", "/transactions", {
      json: { accountId: String(A.account._id), categoryId: String(catB._id), type: "expense", amountMinor: 1, currency: "USD", date: "2025-01-11" },
    });
    assert.equal(r.status, 400);
    assert.match(r.data.error, /Category not found/);
  });

  test("A cannot move their own row into B's account", async () => {
    const own = await asA("POST", "/transactions", {
      json: { accountId: String(A.account._id), type: "expense", amountMinor: 500, currency: "USD", date: "2025-01-12" },
    });
    const id = own.data.created[0]._id;
    const r = await asA("PUT", `/transactions/${id}`, { json: { accountId: String(B.account._id) } });
    assert.equal(r.status, 400);
    assert.equal(String((await Transaction.findById(id).lean()).accountId), String(A.account._id));
    await bobRowUnchanged();
  });

  test("writes validate input before touching the ledger", async () => {
    const base = { accountId: String(A.account._id), type: "expense", amountMinor: 100, currency: "USD", date: "2025-01-12" };
    const count = await Transaction.countDocuments({ userId: A.user._id });
    for (const bad of [{ amountMinor: "100" }, { type: "gift" }, { currency: "EUR" }, { accountId: "not-an-id" }]) {
      const r = await asA("POST", "/transactions", { json: { ...base, ...bad } });
      assert.equal(r.status, 400, JSON.stringify(bad));
    }
    assert.equal(await Transaction.countDocuments({ userId: A.user._id }), count);
  });

  test("with Redis down, a reminder update and a delete still succeed promptly", async () => {
    const own = await asA("POST", "/transactions", {
      json: { accountId: String(A.account._id), type: "expense", amountMinor: 700, currency: "USD", date: "2099-01-01" },
    });
    const id = own.data.created[0]._id;
    const t0 = Date.now();
    const upd = await asA("PUT", `/transactions/${id}`, { json: { reminder: { enabled: true, offsetMinutes: 60 } } });
    assert.equal(upd.status, 200, JSON.stringify(upd.data));
    assert.equal(upd.data.reminder.enabled, true);
    const del = await asA("DELETE", `/transactions/${id}`);
    assert.equal(del.status, 200);
    assert.ok(Date.now() - t0 < 8000, "queue side effects are bounded, not blocking");
  });
});
