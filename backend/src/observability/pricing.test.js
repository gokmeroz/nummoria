import { test } from "node:test";
import assert from "node:assert/strict";
import { computeCost, PRICE_TABLE_VERSION } from "./pricing.js";
import { describePrompt } from "./promptRegistry.js";
import { redactValue } from "./redact.js";

test("known model + usage: cost is computed and versioned", () => {
  const c = computeCost("openai", "gpt-4o-mini", { inputTokens: 1_000_000, outputTokens: 1_000_000 });
  assert.equal(c.totalUsd, 0.75);
  assert.equal(c.priceVersion, PRICE_TABLE_VERSION);
});

test("unknown model or missing usage: cost is unknown (null), not 0", () => {
  assert.deepEqual(computeCost("openai", "gpt-unknown", { inputTokens: 10, outputTokens: 10 }), { totalUsd: null, priceVersion: null });
  assert.deepEqual(computeCost("openai", "gpt-4o-mini", {}), { totalUsd: null, priceVersion: null });
});

test("prompt hash changes on any edit; version comes from the registry", () => {
  const a = describePrompt("extract.transactions", "prompt A");
  const b = describePrompt("extract.transactions", "prompt A ");
  assert.equal(a.version, 1);
  assert.notEqual(a.hash, b.hash);
  assert.equal(describePrompt("unregistered", "x").version, 0);
});

test("redaction scrubs emails and long digit runs, keeps amounts", () => {
  const out = redactValue({ text: "mail jane@example.com acct 1234 5678 9012 3456 paid 42.50", n: 3 });
  assert.equal(out.text, "mail [email] acct [num:16d] paid 42.50");
  assert.equal(out.n, 3);
});
