// backend/src/eval/datasets/synthetic/render.js
//
// Turns an abstract transaction history (generateProfiles.js) into the text
// a real bank statement would contain, for a given layout — plus the ground
// truth the eval scores extraction against. Noise is applied only to the
// *rendered* text; groundTruth always holds the true underlying values, so
// a noisy case that still extracts correctly is a genuine pass, and one
// that doesn't is a genuine, informative failure.

import { pick, chance, randInt } from "./rng.js";

function formatDate(iso, layout, rng) {
  const [y, m, d] = iso.split("-").map(Number);
  let day = d;
  let month = m;
  // Only a day<=12/month<=12 date can be ambiguously reordered — that's the
  // real-world edge case (a statement inconsistently swaps DD/MM for some
  // rows). groundTruth keeps the true date regardless.
  if (day <= 12 && month <= 12 && chance(rng, layout.noise.ambiguousDateProb)) {
    [day, month] = [month, day];
  }
  const dd = String(day).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  if (layout.dateFormat === "MM/DD/YYYY") return `${mm}/${dd}/${y}`;
  if (layout.dateFormat === "DD.MM.YYYY") return `${dd}.${mm}.${y}`;
  return iso;
}

function formatAmount(amount, layout, rng) {
  const sign = amount < 0 ? "-" : "";
  let [whole, frac = "00"] = Math.abs(amount).toFixed(2).split(".");
  let str =
    layout.decimalStyle === "comma" ? `${whole},${frac}` : `${whole}.${frac}`;

  if (chance(rng, layout.noise.ocrTypoProb)) {
    const pos = randInt(rng, 0, str.length - 1);
    const ch = str[pos];
    if (/\d/.test(ch)) {
      const digit = String(randInt(rng, 0, 9));
      str = str.slice(0, pos) + digit + str.slice(pos + 1);
    }
  }
  return sign + str;
}

function pickDescription(tx, layout, rng) {
  const pool = layout.merchants[tx.category] || ["MISC TRANSACTION"];
  return pick(rng, pool);
}

/** Attach layout-appropriate merchant text; shared by both renderers so
 * groundTruth is identical regardless of which format is rendered. */
export function enrichWithDescriptions(transactions, layout, rng) {
  return transactions.map((t) => ({ ...t, description: pickDescription(t, layout, rng) }));
}

export function renderCSV(enriched, layout, rng) {
  const { csv } = layout;
  // A comma-decimal layout ("-9,25") can't also use comma as the field
  // delimiter — the decimal mark would be indistinguishable from a column
  // break. Real European/Turkish bank exports dodge this the same way:
  // semicolon-delimited when the decimal mark is a comma.
  const delim = layout.decimalStyle === "comma" ? ";" : ",";
  const headers =
    csv.amountMode === "credit-debit"
      ? [csv.dateHeader, csv.descriptionHeader, csv.creditHeader, csv.debitHeader]
      : [csv.dateHeader, csv.descriptionHeader, csv.amountHeader];

  const lines = [headers.join(delim)];
  for (const tx of enriched) {
    const date = formatDate(tx.date, layout, rng);
    const desc = chance(rng, layout.noise.missingDescriptionProb)
      ? ""
      : `"${tx.description.replace(/"/g, '""')}"`;

    if (csv.amountMode === "credit-debit") {
      const credit = tx.amount > 0 ? formatAmount(tx.amount, layout, rng) : "";
      const debit = tx.amount < 0 ? formatAmount(-tx.amount, layout, rng) : "";
      lines.push([date, desc, credit, debit].join(delim));
    } else {
      lines.push([date, desc, formatAmount(tx.amount, layout, rng)].join(delim));
    }
  }
  return lines.join("\n");
}

export function renderPdfText(enriched, layout, rng) {
  const lines = [
    `${layout.description.split(" — ")[0]} — Statement`,
    `Period: ${enriched[0]?.date ?? ""} to ${enriched[enriched.length - 1]?.date ?? ""}`,
    "",
  ];

  for (const tx of enriched) {
    const date = formatDate(tx.date, layout, rng);
    const amount = formatAmount(tx.amount, layout, rng);
    const desc = chance(rng, layout.noise.missingDescriptionProb) ? "" : tx.description;

    if (chance(rng, layout.noise.multilineProb)) {
      lines.push(date, amount, desc);
    } else {
      const gap = chance(rng, layout.noise.extraWhitespaceProb) ? "   " : "  ";
      lines.push(`${date}${gap}${desc}${gap}${amount}`);
    }
  }
  return lines.join("\n");
}

export function toGroundTruth(enriched) {
  return enriched.map((t) => ({
    date: t.date,
    amount: t.amount,
    description: t.description,
    category: t.category,
  }));
}
