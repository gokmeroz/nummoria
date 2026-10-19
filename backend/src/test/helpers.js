// backend/src/test/helpers.js
//
// Shared setup for tests that need MongoDB (ownership, persistence,
// idempotency, tracing). Unit tests don't import this.
//
//   MONGO_TEST_URI=mongodb://127.0.0.1:27017 npm test
//
// Without MONGO_TEST_URI the DB-backed suites are SKIPPED and say so —
// unless REQUIRE_DB_TESTS=1 (CI), where a missing database is a failure, so
// a green CI run can't silently mean "the integration tests never ran".
//
// Safety: only a local server is accepted and every suite gets its own
// throwaway database named nummoria_test_<suite>_<pid>, dropped afterwards.
import crypto from "node:crypto";
import mongoose from "mongoose";

// Set before any app module is imported (auth.js reads it at import time).
process.env.JWT_SECRET ||= "test-only-jwt-secret";
process.env.REGISTRATION_TOKEN_SECRET ||= "test-only-registration-secret";
// Redis deliberately unreachable: proves queue side effects never block or
// fail a ledger write (reminders time out and are logged).
process.env.REDIS_URL ||= "redis://127.0.0.1:1";

const URI = process.env.MONGO_TEST_URI;

export function dbSuiteOptions() {
  if (URI) return {};
  if (process.env.REQUIRE_DB_TESTS === "1") {
    throw new Error("REQUIRE_DB_TESTS=1 but MONGO_TEST_URI is not set");
  }
  return { skip: "MONGO_TEST_URI not set — DB-backed tests skipped" };
}

export async function connectTestDb(suite) {
  const host = new URL(URI.replace(/^mongodb(\+srv)?:/, "http:")).hostname;
  if (!["127.0.0.1", "localhost", "::1", "mongo", "mongodb"].includes(host)) {
    throw new Error(`refusing to run tests against non-local MongoDB host "${host}"`);
  }
  const dbName = `nummoria_test_${suite}_${process.pid}`;
  await mongoose.connect(URI, { dbName, serverSelectionTimeoutMS: 5000 });
  // Register the models with unique indexes, then wait for their indexes —
  // otherwise a test can race the background build (and pass or fail by luck).
  await import("../models/transaction.js");
  await import("../models/user.js");
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  return dbName;
}

export async function disconnectTestDb() {
  if (mongoose.connection.readyState === 1) {
    if (!mongoose.connection.name.startsWith("nummoria_test_")) {
      throw new Error(`refusing to drop non-test database ${mongoose.connection.name}`);
    }
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
  const { closeQueues } = await import("../queues/index.js");
  const { closeQuotaRedis } = await import("../middlewares/aiQuota.js");
  await Promise.all([closeQueues(), closeQuotaRedis()]);
}

/** Start the real app (full middleware chain) on an ephemeral port. */
export async function startApp() {
  const { default: app } = await import("../app.js");
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((r) => server.close(r)),
  };
}

export async function tokenFor(user) {
  const { default: jwt } = await import("jsonwebtoken");
  return jwt.sign({ id: String(user._id) }, process.env.JWT_SECRET, { expiresIn: "1h" });
}

/** A user with a USD checking account; returns { user, account, token }. */
export async function makeUserWithAccount(label, { currency = "USD", balance = 0 } = {}) {
  const { User } = await import("../models/user.js");
  const { Account } = await import("../models/account.js");
  const user = await User.create({
    name: label,
    email: `${label}-${crypto.randomUUID()}@test.invalid`,
    passwordHash: "x",
  });
  const account = await Account.create({ userId: user._id, name: `${label} checking`, currency, balance });
  return { user, account, token: await tokenFor(user) };
}

export function api(baseUrl, token) {
  return async (method, path, { json, form, headers = {} } = {}) => {
    const h = { ...headers };
    if (token) h.Authorization = `Bearer ${token}`;
    let body;
    if (json !== undefined) {
      h["Content-Type"] = "application/json";
      body = JSON.stringify(json);
    } else if (form) {
      body = form;
    }
    const res = await fetch(baseUrl + path, { method, headers: h, body });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { status: res.status, data };
  };
}

export function fileForm(name, content, type) {
  const form = new FormData();
  form.append("file", new Blob([content], { type }), name);
  return form;
}
