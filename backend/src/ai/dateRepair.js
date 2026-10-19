// backend/src/ai/dateRepair.js
//
// Last-resort reading for ambiguous dates (both parts <= 12) that neither the
// document-wide order nor the statement period could settle. Statements list
// transactions chronologically, so a row's date must sit between the
// unambiguous dates around it. If exactly one reading does, use it.
//
// Only unambiguous rows anchor the check (never a row this function
// changed), and nothing happens unless the anchors themselves show a clear
// direction — an unsorted export gets no repairs at all.
import { normalizeDate } from "./statementNormalize.js";

/**
 * rows: [{ date, _dateRaw, _dateEvidence }] in document order (mutated).
 * Returns the number of rows whose date was changed.
 */
export function repairDatesByNeighbors(rows) {
  const anchors = [];
  rows.forEach((r, i) => {
    if (r._dateEvidence === "unambiguous") anchors.push(i);
  });
  let asc = 0;
  let desc = 0;
  for (let k = 1; k < anchors.length; k++) {
    const a = rows[anchors[k - 1]].date;
    const b = rows[anchors[k]].date;
    if (a < b) asc++;
    else if (a > b) desc++;
  }
  const direction = asc > 0 && asc >= 3 * desc ? "asc" : desc > 0 && desc >= 3 * asc ? "desc" : null;
  if (!direction) return 0;

  let changed = 0;
  let prevAnchor = null;
  let nextPtr = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r._dateEvidence === "unambiguous") {
      prevAnchor = r.date;
      continue;
    }
    while (nextPtr < anchors.length && anchors[nextPtr] <= i) nextPtr++;
    const nextAnchor = nextPtr < anchors.length ? rows[anchors[nextPtr]].date : null;

    const fits = (d) => {
      if (!d) return false;
      const [lo, hi] = direction === "asc" ? [prevAnchor, nextAnchor] : [nextAnchor, prevAnchor];
      return (lo == null || lo <= d) && (hi == null || d <= hi);
    };
    const dmy = normalizeDate(r._dateRaw, "DMY");
    const mdy = normalizeDate(r._dateRaw, "MDY");
    const other = r.date === dmy ? mdy : dmy;
    if (!fits(r.date) && fits(other)) {
      r.date = other;
      r._dateEvidence = "neighbors";
      changed++;
    }
  }
  return changed;
}
