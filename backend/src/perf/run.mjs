import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import http from "node:http";
import crypto from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const here = path.dirname(fileURLToPath(import.meta.url));
const backend = path.resolve(here, "../..");
const profile = process.argv[2] || "smoke";
if (!["smoke", "capacity"].includes(profile)) throw new Error("Usage: node src/perf/run.mjs smoke|capacity");
if (Number(process.versions.node.split(".")[0]) !== 22) throw new Error("Use the supported Node.js 22 runtime");
const bins = Object.fromEntries(["MONGODB_BIN", "REDIS_BIN", "K6_BIN"].map((key) => {
  const value = process.env[key];
  if (!value || !path.isAbsolute(value)) throw new Error(`${key} must be an absolute path to the local binary`);
  fs.accessSync(value, fs.constants.X_OK); return [key, value];
}));
const runId = `${new Date().toISOString().replace(/[-:.TZ]/g, "")}_${crypto.randomBytes(3).toString("hex")}`;
const out = path.resolve(backend, "perf-results", `${profile}_${runId}`);
fs.mkdirSync(out, { recursive: true });
console.log(`Output: ${out}`);
const save = (name, value) => fs.writeFileSync(path.join(out, name), JSON.stringify(value, null, 2) + "\n");
const maxVus = profile === "smoke" ? 5 : 1250;
const tuples = profile === "smoke" ? [[2, 5, "ramp-5"], [15, 5, "hold-5"], [2, 0, "drain"]] : [
  [10, 10, "ramp-10"], [10, 10, "hold-10"], [10, 100, "ramp-100"], [20, 100, "hold-100"],
  [15, 250, "ramp-250"], [20, 250, "hold-250"], [15, 500, "ramp-500"], [20, 500, "hold-500"],
  [30, 1000, "ramp-1000"], [180, 1000, "hold-1000"], [20, 1250, "ramp-1250"], [60, 1250, "hold-1250"], [20, 0, "drain"],
];
const config = { profile, runId, maxVus, transactionsPerUser: 100, password: "Local-load-test-only-2026!",
  stages: tuples.map(([seconds, target, phase]) => ({ seconds, duration: `${seconds}s`, target, phase })),
  gatedPhases: profile === "smoke" ? ["hold-5"] : ["hold-1000", "hold-1250"],
  assumptions: { thinkSeconds: profile === "smoke" ? 0.1 : [5, 10], loginOnce: true,
    defaultIpRateLimitPreservedInProbe: true, capacityRateMax: 1000000000, capacityLoginMax: 1000000000,
    paidProviders: false, nodeEnv: "test", appEntrypoint: "src/perf/server.mjs", workerAndCron: false },
};
save("config.json", config);
const children = new Set();
const env = { PATH: process.env.PATH, LANG: "C.UTF-8", TZ: "UTC" };
function child(bin, args, name, extra = {}, ipc = false) {
  const fd = fs.openSync(path.join(out, `${name}.log`), "wx");
  const p = spawn(bin, args, { cwd: backend, env: { ...env, ...extra }, stdio: ipc ? ["ignore", fd, fd, "ipc"] : ["ignore", fd, fd] });
  fs.closeSync(fd); children.add(p); p.on("error", (e) => console.error(`${name}: ${e.message}`));
  p.once("exit", () => children.delete(p)); return p;
}
async function stop(p) {
  if (!p || p.exitCode !== null || p.signalCode !== null) return;
  await new Promise((resolve) => {
    const timer = setTimeout(() => { p.kill("SIGKILL"); }, 8000);
    p.once("exit", () => { clearTimeout(timer); resolve(); }); p.kill("SIGTERM");
  });
}
let cleaning = false;
async function cleanup() {
  if (cleaning) return; cleaning = true;
  await mongoose.disconnect();
  for (const p of [...children].reverse()) await stop(p);
}
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, async () => { await cleanup(); process.exit(130); });
async function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer(); s.once("error", reject);
    s.listen(0, "127.0.0.1", () => { const port = s.address().port; s.close(() => resolve(port)); });
  });
}
async function waitPort(port, p) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (p.exitCode !== null || p.signalCode !== null) throw new Error(`Service exited before opening port ${port}; inspect logs`);
    const ok = await new Promise((resolve) => {
      const s = net.connect({ host: "127.0.0.1", port });
      s.once("connect", () => { s.destroy(); resolve(true); }); s.once("error", () => resolve(false));
    });
    if (ok) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Local service on ${port} did not become ready`);
}
const secret = crypto.randomBytes(32).toString("hex");
let mongo, redis, app, k6, sampler;
try {
  const mongoPort = await freePort(), redisPort = await freePort();
  const dbName = `nummoria_load_${runId}`;
  const uri = `mongodb://127.0.0.1:${mongoPort}/${dbName}`;
  fs.mkdirSync(path.join(out, "mongo-data")); fs.mkdirSync(path.join(out, "redis-data"));
  mongo = child(bins.MONGODB_BIN, ["--bind_ip", "127.0.0.1", "--port", String(mongoPort), "--nounixsocket", "--dbpath", path.join(out, "mongo-data"), "--wiredTigerCacheSizeGB", "0.25"], "mongo");
  redis = child(bins.REDIS_BIN, ["--bind", "127.0.0.1", "--port", String(redisPort), "--save", "", "--appendonly", "no", "--dir", path.join(out, "redis-data")], "redis");
  await Promise.all([waitPort(mongoPort, mongo), waitPort(redisPort, redis)]);
  const version = (bin) => execFileSync(bin, ["--version"], { encoding: "utf8", env }).trim();
  const readLimit = (file) => { try { return fs.readFileSync(file, "utf8").trim(); } catch { return null; } };
  save("environment.json", { at: new Date().toISOString(), startCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: backend, encoding: "utf8" }).trim(),
    trackedDiffAtStart: execFileSync("git", ["diff", "--stat"], { cwd: backend, encoding: "utf8" }),
    harnessSha256: Object.fromEntries(["run.mjs", "server.mjs", "session.k6.js"].map((name) =>
      [name, crypto.createHash("sha256").update(fs.readFileSync(path.join(here, name))).digest("hex")])),
    platform: process.platform, arch: process.arch, node: process.version, cpu: os.cpus()[0].model, logicalCpus: os.cpus().length,
    cpuQuota: readLimit("/sys/fs/cgroup/cpu.max"), memoryLimit: readLimit("/sys/fs/cgroup/memory.max"),
    mongo: version(bins.MONGODB_BIN), redis: version(bins.REDIS_BIN), k6: version(bins.K6_BIN),
    topology: "load generator, one API process, one MongoDB server and one Redis server share this host; loopback HTTP; no TLS/proxy",
    mongoPoolSize: "default (100); untouched", database: dbName });
  await mongoose.connect(uri, { autoIndex: false });
  const { User } = await import("../models/user.js");
  const { Account } = await import("../models/account.js");
  const { Category } = await import("../models/category.js");
  const { Transaction } = await import("../models/transaction.js");
  await Promise.all([User, Account, Category, Transaction].map((m) => m.createIndexes()));
  const passwordHash = await bcrypt.hash(config.password, 10);
  const identities = [], users = [], accounts = [], categories = [];
  for (let i = 0; i < maxVus; i++) {
    const userId = new mongoose.Types.ObjectId(), accountId = new mongoose.Types.ObjectId();
    const categoryId = new mongoose.Types.ObjectId(), salaryId = new mongoose.Types.ObjectId();
    const email = `load-${i}@test.invalid`;
    identities.push({ userId: String(userId), accountId: String(accountId), categoryId: String(categoryId), email });
    users.push({ _id: userId, name: `Synthetic ${i}`, email, passwordHash, isActive: true, isEmailVerified: true,
      role: "user", subscription: "Standard", baseCurrency: "USD", tz: "UTC", consent: { accepted: true, version: "v1" }, createdAt: new Date() });
    accounts.push({ _id: accountId, userId, name: "Synthetic checking", type: "checking", currency: "USD", balance: 175000, isDeleted: false });
    categories.push({ _id: categoryId, userId, name: "Groceries", kind: "expense", isDeleted: false },
      { _id: salaryId, userId, name: "Salary", kind: "income", isDeleted: false });
  }
  await User.collection.insertMany(users); await Account.collection.insertMany(accounts); await Category.collection.insertMany(categories);
  let batch = [];
  for (let i = 0; i < maxVus; i++) for (let j = 0; j < 100; j++) {
    const income = j % 4 === 0;
    batch.push({ userId: users[i]._id, accountId: accounts[i]._id, categoryId: categories[i * 2 + (income ? 1 : 0)]._id,
      type: income ? "income" : "expense", amountMinor: income ? 10000 : 1000, currency: "USD",
      date: new Date(`2026-01-${String(j % 28 + 1).padStart(2, "0")}T00:00:00Z`),
      description: `seed:${i}:${j}`, isDeleted: false, reminder: { enabled: false }, createdAt: new Date() });
    if (batch.length === 5000) { await Transaction.collection.insertMany(batch); batch = []; }
  }
  if (batch.length) await Transaction.collection.insertMany(batch);
  save("users.json", identities);
  console.log(`Seeded ${maxVus} users and ${maxVus * 100} transactions, with real indexes.`);
  await mongoose.disconnect();
  async function startApp(name, raised) {
    const p = child(process.execPath, [path.join(here, "server.mjs")], name, {
      NODE_ENV: "test", NUMMORIA_LOAD_TEST: "local-only", DB_TARGET: "dev", MONGO_URI: uri,
      REDIS_URL: `redis://127.0.0.1:${redisPort}`, JWT_SECRET: secret, REGISTRATION_TOKEN_SECRET: secret,
      ENABLE_QUOTES: "false", AI_TRACING_ENABLED: "false", EXTRACTION_ESCALATION: "off", TRUST_PROXY: "false",
      ...(raised ? { RATE_MAX: "1000000000", RATE_LOGIN_MAX: "1000000000" } : {}),
      PERF_RESOURCE_PATH: path.join(out, `${name}-resources.jsonl`),
    }, true);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`${name} startup timed out`)), 30000);
      p.once("exit", (code) => { clearTimeout(timeout); reject(new Error(`${name} exited ${code}`)); });
      p.on("message", (m) => { if (m.ready) { clearTimeout(timeout); resolve({ p, url: `http://127.0.0.1:${m.port}` }); } });
    });
  }
  app = await startApp("limiter-app", false);
  const statuses = {};
  const tokens = identities.slice(0, 2).map((u) => jwt.sign({ id: u.userId }, secret, { expiresIn: "1h" }));
  for (let i = 0; i < 302; i++) {
    const status = await new Promise((resolve, reject) => {
      const request = http.get(app.url + "/me", { headers: { Authorization: `Bearer ${tokens[i % 2]}` } }, (response) => {
        response.resume(); response.once("end", () => resolve(response.statusCode));
      });
      request.setTimeout(5000, () => request.destroy(new Error("Limiter probe timeout")));
      request.once("error", reject);
    });
    statuses[status] = (statuses[status] || 0) + 1;
  }
  const limiter = { requests: 302, identities: 2, sourceIps: 1, statuses,
    passed: statuses[200] === 300 && statuses[429] === 2 };
  save("limiter-probe.json", limiter); await stop(app.p);
  if (!limiter.passed) throw new Error("Default limiter probe failed; investigate before the capacity run");
  console.log("Default limiter probe: 300 successes, then 2 HTTP 429s across two identities.");
  app = await startApp("capacity-app", true);
  k6 = child(bins.K6_BIN, ["run", "--no-usage-report", path.join(here, "session.k6.js")], "k6", {
    PERF_BASE_URL: app.url, PERF_CONFIG: path.join(out, "config.json"), PERF_USERS: path.join(out, "users.json"), PERF_SUMMARY: path.join(out, "k6-summary.json"),
  });
  const clk = Number(execFileSync("getconf", ["CLK_TCK"], { encoding: "utf8" }).trim());
  const resources = fs.createWriteStream(path.join(out, "process-resources.jsonl"), { flags: "wx" });
  const previous = new Map();
  sampler = setInterval(() => {
    const sample = { time: new Date().toISOString(), processes: {} };
    for (const [name, p] of [["mongo", mongo], ["redis", redis], ["k6", k6]]) {
      try {
        const raw = fs.readFileSync(`/proc/${p.pid}/stat`, "utf8");
        const fields = raw.slice(raw.lastIndexOf(")") + 2).split(" ");
        const ticks = Number(fields[11]) + Number(fields[12]), now = Date.now(), last = previous.get(name);
        const status = fs.readFileSync(`/proc/${p.pid}/status`, "utf8");
        sample.processes[name] = { pid: p.pid, rssBytes: Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1] || 0) * 1024,
          cpuPercentOfOneCore: last ? (ticks - last.ticks) / clk / ((now - last.now) / 1000) * 100 : null };
        previous.set(name, { ticks, now });
      } catch { /* process already exited */ }
    }
    resources.write(JSON.stringify(sample) + "\n");
  }, 1000);
  console.log(`Running ${profile}: ${tuples.reduce((s, t) => s + t[0], 0)} scheduled seconds; peak ${maxVus} VUs.`);
  const k6Code = await new Promise((resolve, reject) => { k6.once("error", reject); k6.once("exit", resolve); });
  clearInterval(sampler); resources.end(); await stop(app.p);
  const summary = JSON.parse(fs.readFileSync(path.join(out, "k6-summary.json"), "utf8"));
  await mongoose.connect(uri, { autoIndex: false });
  const totals = await Transaction.aggregate([{ $match: { isDeleted: false } }, { $group: {
    _id: { accountId: "$accountId", userId: "$userId", currency: "$currency" },
    signed: { $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amountMinor", { $multiply: ["$amountMinor", -1] }] } }, count: { $sum: 1 },
  } }]);
  const finalAccounts = await Account.find({}).lean();
  const accountMap = new Map(finalAccounts.map((a) => [String(a._id), a]));
  const mismatches = totals.filter((t) => {
    const a = accountMap.get(String(t._id.accountId));
    return !a || String(a.userId) !== String(t._id.userId) || t._id.currency !== "USD" || a.balance !== t.signed;
  });
  const match = { description: { $regex: `^load:${runId}:` } };
  const persistedWrites = await Transaction.countDocuments(match);
  const duplicates = await Transaction.aggregate([{ $match: match }, { $group: { _id: "$description", n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }, { $limit: 10 }]);
  const acknowledgedWrites = summary.metrics.write_successes?.values?.count ?? 0;
  const reconciliation = { accounts: finalAccounts.length, buckets: totals.length, expectedAccounts: maxVus,
    mismatches, duplicateIdentifiers: duplicates, persistedWrites, acknowledgedWrites,
    passed: finalAccounts.length === maxVus && totals.length === maxVus && !mismatches.length && !duplicates.length && persistedWrites === acknowledgedWrites && persistedWrites > 0 };
  save("reconciliation.json", reconciliation);
  const failedThresholds = Object.entries(summary.metrics).flatMap(([metric, data]) => Object.entries(data.thresholds || {}).filter(([, v]) => !v.ok).map(([threshold]) => ({ metric, threshold })));
  const result = { profile, runId, output: out, k6ExitCode: k6Code, limiter, reconciliation,
    failedThresholds, passed: k6Code === 0 && limiter.passed && reconciliation.passed && !failedThresholds.length,
    warning: "Isolated local API benchmark only; inspect per-plateau metrics and actual throughput. No production or live-provider capacity claim." };
  save("result.json", result);
  console.log(JSON.stringify({ passed: result.passed, authenticated: summary.metrics.users_authenticated?.values?.count,
    acknowledgedWrites, reconciliationPassed: reconciliation.passed, failedThresholds, output: out }));
  if (!result.passed) process.exitCode = 1;
} catch (error) {
  save("runner-error.json", { message: error.message, stack: error.stack });
  console.error(error.message); process.exitCode = 1;
} finally {
  if (sampler) clearInterval(sampler);
  await cleanup();
}
