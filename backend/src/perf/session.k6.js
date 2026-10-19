import http from "k6/http";
import { sleep } from "k6";
import exec from "k6/execution";
import { SharedArray } from "k6/data";
import { Counter, Rate } from "k6/metrics";

const base = __ENV.PERF_BASE_URL;
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base || "")) throw new Error("Loopback-only target required");
const config = JSON.parse(open(__ENV.PERF_CONFIG));
const users = new SharedArray("synthetic identities", () => JSON.parse(open(__ENV.PERF_USERS)));
const errors = new Rate("unexpected_errors");
const semantic = new Counter("semantic_failures");
const limited = new Counter("rate_limited");
const authenticated = new Counter("users_authenticated");
const writes = new Counter("write_successes");
const actions = ["transactions", "accounts", "transactions", "categories", "me", "transactions", "accounts", "categories", "transactions", "create"];
const thresholds = {
  semantic_failures: ["count==0"], rate_limited: ["count==0"],
  users_authenticated: [`count==${config.maxVus}`], write_successes: ["count>0"],
  "http_req_duration{endpoint:login}": ["p(95)<2000"],
};
for (const phase of config.gatedPhases) {
  thresholds[`unexpected_errors{phase:${phase}}`] = ["rate<0.01"];
  thresholds[`http_req_duration{phase:${phase}}`] = ["p(99)<2000"];
  thresholds[`http_reqs{phase:${phase}}`] = ["count>0"];
  thresholds[`write_successes{phase:${phase}}`] = ["count>0"];
  for (const endpoint of ["transactions", "accounts", "categories", "me", "create"]) {
    thresholds[`http_req_duration{phase:${phase},endpoint:${endpoint}}`] = [endpoint === "create" ? "p(95)<1000" : "p(95)<500"];
  }
}
export const options = {
  scenarios: { sessions: { executor: "ramping-vus", startVUs: 0,
    stages: config.stages.map(({ duration, target }) => ({ duration, target })), gracefulRampDown: "20s", gracefulStop: "20s" } },
  thresholds, summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"],
  maxRedirects: 0, noCookiesReset: false, systemTags: ["status", "method", "name", "scenario", "expected_response"],
};
let token = null;
function phaseNow() {
  const elapsed = Date.now() - exec.scenario.startTime;
  let end = 0;
  for (const s of config.stages) { end += s.seconds * 1000; if (elapsed < end) return s.phase; }
  return "drain";
}
function parse(response) { try { return response.json(); } catch { return null; } }
function failIfFalse(value) { semantic.add(value ? 0 : 1); }
function request(method, path, endpoint, body) {
  const phase = phaseNow(), tags = { endpoint, phase, name: endpoint };
  const response = http.request(method, base + path, body == null ? null : JSON.stringify(body), {
    timeout: "5s", redirects: 0, tags,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const expected = endpoint === "create" ? 201 : 200;
  errors.add(response.status !== expected, tags); limited.add(response.status === 429 ? 1 : 0, tags);
  return { response, data: parse(response), tags };
}
export default function () {
  const user = users[exec.vu.idInTest - 1];
  if (!user) throw new Error("Missing independent user");
  if (!token) {
    if (config.profile !== "smoke") sleep((exec.vu.idInTest * 0.61803398875) % 10);
    const { response, data } = request("POST", "/auth/login", "login", { email: user.email, password: config.password });
    const ok = response.status === 200 && data?.token && data?.user?.id === user.userId;
    failIfFalse(ok);
    if (!ok) { sleep(1); return; }
    token = data.token; authenticated.add(1);
  }
  const action = actions[(exec.vu.idInTest + exec.vu.iterationInScenario) % actions.length];
  if (action === "create") {
    const description = `load:${config.runId}:${exec.vu.idInTest}:${exec.vu.iterationInScenario}`;
    const { response, data, tags } = request("POST", "/transactions", action, {
      accountId: user.accountId, categoryId: user.categoryId, type: "expense", amountMinor: 100,
      currency: "USD", date: "2026-01-15", description, reminder: { enabled: false },
    });
    if (response.status === 201) {
      const row = data?.created?.[0];
      const ok = data?.createdCount === 1 && data.created.length === 1 && row.userId === user.userId &&
        row.accountId === user.accountId && row.amountMinor === 100 && row.currency === "USD" && row.description === description;
      failIfFalse(ok); if (ok) writes.add(1, tags);
    }
  } else {
    const { response, data } = request("GET", `/${action}`, action);
    if (response.status === 200) {
      if (action === "me") failIfFalse(data?._id === user.userId && data.email === user.email);
      else failIfFalse(Array.isArray(data) && data.length > 0 && data.every((row) => row.userId === user.userId) &&
        (action !== "transactions" || data.every((row) => row.accountId === user.accountId && row.currency === "USD" && Number.isInteger(row.amountMinor))));
    }
  }
  sleep(config.profile === "smoke" ? 0.1 : 5 + ((exec.vu.idInTest * 7 + exec.vu.iterationInScenario * 3) % 51) / 10);
}
export function handleSummary(data) {
  return { [__ENV.PERF_SUMMARY]: JSON.stringify(data, null, 2), stdout: `k6 finished; ${Object.keys(data.metrics).length} metrics written to summary\n` };
}
