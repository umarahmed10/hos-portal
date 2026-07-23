// CSV parsing for the Google Ads metrics importer. Handles quoted fields,
// currency-formatted numbers, and the several date formats Google Ads exports.

// RFC-4180-ish parser: quotes, escaped quotes, commas + newlines inside quotes.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(cell => cell.trim() !== ""));
}

// Strip currency symbols / thousands separators → number. "" / "--" → 0.
export function parseNum(s: string): number {
  if (!s) return 0;
  const cleaned = s.replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

// Normalize a cell to YYYY-MM-DD, or null if it isn't a date.
export function parseDate(s: string): string | null {
  const t = (s || "").trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const d = new Date(t);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type ColKind = "date" | "spend" | "calls" | "qualified";

// Best-guess column index for each field from a header row (fuzzy match).
export function detectColumns(header: string[]): Record<ColKind, number> {
  const norm = header.map(h => h.trim().toLowerCase());
  const find = (tests: RegExp[], avoid: RegExp[] = []): number => {
    for (let i = 0; i < norm.length; i++) {
      const h = norm[i];
      if (avoid.some(a => a.test(h))) continue;
      if (tests.some(t => t.test(h))) return i;
    }
    return -1;
  };
  return {
    date:      find([/^day$/, /^date$/, /date/, /^day/]),
    spend:     find([/cost/, /spend/, /amount spent/]),
    calls:     find([/phone call/, /^calls?$/, /call volume/, /total calls/], [/cost/, /miss/]),
    qualified: find([/qualif/, /conversions?/], [/rate/, /value/, /cost/]),
  };
}

// Find the header row index (skips Google Ads title/date-range preamble).
export function findHeaderRow(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const cols = detectColumns(rows[i]);
    if (cols.date >= 0 && (cols.spend >= 0 || cols.calls >= 0)) return i;
  }
  return 0;
}
