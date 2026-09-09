// backend/src/observability/promptRegistry.js
//
// Turns "which prompt was this call?" into a stable value on the span.
//
// version: bump DELIBERATELY when you change a prompt's strategy. This is the
//   number eval baselines are pinned to ("prompt v4 scored 0.82").
// hash:    derived from the actual rendered text, changes on ANY edit. It is
//   the tamper-detector: version unchanged + hash changed => someone edited the
//   prompt without bumping, and every baseline comparison since is invalid.
import crypto from "crypto";

const VERSIONS = {
  "advisor.system": 1,
  "extract.transactions": 1,
};

export function describePrompt(id, text) {
  return {
    id,
    version: VERSIONS[id] ?? 0,
    hash: crypto
      .createHash("sha256")
      .update(String(text ?? ""))
      .digest("hex")
      .slice(0, 16),
  };
}
