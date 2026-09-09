// backend/src/observability/redact.js
//
// Best-effort scrub applied to trace payloads before they are stored in the
// production env. Intentionally conservative for v1:
//   - email addresses  -> [email]
//   - long digit runs  -> [num:Nd]   (card / IBAN / account numbers)
//
// KNOWN LIMITATION: it does not touch short amounts or merchant names. Amounts
// alone are not identifying; merchant strings are the next thing to handle when
// P5 tightens this. The redacted flag on each payload row records which mode
// produced the content.
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const LONG_DIGITS = /\d[\d\s-]{9,}\d/g;

export function redactString(s) {
  if (typeof s !== "string") return s;
  return s
    .replace(EMAIL, "[email]")
    .replace(LONG_DIGITS, (m) => `[num:${m.replace(/\D/g, "").length}d]`);
}

export function redactValue(v, depth = 0) {
  if (v == null) return null;
  if (depth > 6) return "[depth-limit]";
  if (typeof v === "string") return redactString(v);
  if (typeof v === "number" || typeof v === "boolean") return v;
  if (Array.isArray(v)) return v.map((x) => redactValue(x, depth + 1));
  if (typeof v === "object") {
    const out = {};
    for (const [k, val] of Object.entries(v)) out[k] = redactValue(val, depth + 1);
    return out;
  }
  return null;
}
