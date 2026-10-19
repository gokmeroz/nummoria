// Recurring occurrences are booked exactly once, even when a run is
// retried after a crash or two runs overlap.
import { describe, test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { dbSuiteOptions, connectTestDb, disconnectTestDb } from "../test/helpers.js";

const day = (s) => new Date(`${s}T00:00:00.000Z`);

describe("recurring transactions job", dbSuiteOptions(), () => {
  let Transaction, processDueRecurringTransactions;
  const userId = new mongoose.Types.ObjectId();
  const accountId = new mongoose.Types.ObjectId();

  before(async () => {
    await connectTestDb("recurring");
    ({ Transaction } = await import("../models/transaction.js"));
    ({ processDueRecurringTransactions } = await import("../services/recurringService.js"));
    // Production runs with autoIndex off: the job must create the index it
    // relies on itself, so start every test from a collection without it.
    await Transaction.collection.dropIndex("recurrenceParentId_1_recurrenceDate_1");
  });
  beforeEach(() => Transaction.deleteMany({}));
  after(disconnectTestDb);

  const template = (over = {}) =>
    Transaction.create({
      userId,
      accountId,
      type: "expense",
      amountMinor: 1500,
      currency: "USD",
      date: day("2025-01-01"),
      description: "GYM",
      frequency: "daily",
      nextProcessedDate: day("2025-01-02"),
      ...over,
    });
  const children = (tpl) => Transaction.find({ recurrenceParentId: tpl._id }).sort({ date: 1 }).lean();

  test("missed days catch up with correctly dated occurrences owned by the template's user", async () => {
    const tpl = await template();
    const r = await processDueRecurringTransactions({ now: day("2025-01-04") });
    assert.equal(r.created, 3);
    const kids = await children(tpl);
    assert.deepEqual(
      kids.map((k) => k.date.toISOString().slice(0, 10)),
      ["2025-01-02", "2025-01-03", "2025-01-04"],
    );
    assert.ok(kids.every((k) => String(k.userId) === String(userId) && !k.frequency));
    assert.equal((await Transaction.findById(tpl._id)).nextProcessedDate.toISOString(), day("2025-01-05").toISOString());
  });

  test("running again the same day books nothing new", async () => {
    const tpl = await template();
    await processDueRecurringTransactions({ now: day("2025-01-03") });
    const r = await processDueRecurringTransactions({ now: day("2025-01-03") });
    assert.equal(r.created, 0);
    assert.equal((await children(tpl)).length, 2);
  });

  test("a crash between booking and advancing is repaired, not duplicated", async () => {
    const tpl = await template();
    // The previous run booked 2025-01-02 and died before advancing the template.
    await Transaction.create({ ...tpl.toObject(), _id: undefined, frequency: undefined, nextProcessedDate: undefined, date: day("2025-01-02"), recurrenceParentId: tpl._id, recurrenceDate: day("2025-01-02") });
    const r = await processDueRecurringTransactions({ now: day("2025-01-03") });
    assert.deepEqual([r.alreadyBooked, r.created], [1, 1]);
    assert.equal((await children(tpl)).length, 2);
  });

  test("overlapping runs book each occurrence once", async () => {
    const tpl = await template();
    await Promise.all([1, 2, 3].map(() => processDueRecurringTransactions({ now: day("2025-01-06") })));
    assert.equal((await children(tpl)).length, 5);
  });

  test("deleted templates and ones past their endDate produce nothing", async () => {
    const del = await template({ isDeleted: true });
    const ended = await template({ endDate: day("2025-01-02") });
    await processDueRecurringTransactions({ now: day("2025-01-05") });
    assert.equal((await children(del)).length, 0);
    assert.equal((await children(ended)).length, 1);
  });
});
