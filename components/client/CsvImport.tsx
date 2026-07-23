"use client";
// Google Ads CSV importer. Upload a report → auto-detect columns → PREVIEW the
// parsed rows (verify before committing — never import a wrong number) → import.
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { parseCsv, parseNum, parseDate, detectColumns, findHeaderRow, type ColKind } from "@/lib/csv";
import { money } from "@/lib/utils";
import { css, BORDER, MUTED, TEXT, GOLD, GREEN } from "@/lib/styles";

interface Props { docId: string; onImported?: () => void }

const LABEL: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.14em",
  textTransform: "uppercase", color: MUTED, marginBottom: 6, display: "block",
};

export function CsvImport({ docId, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<string[][] | null>(null);
  const [headerIdx, setHeaderIdx] = useState(0);
  const [map, setMap] = useState<Record<ColKind, number>>({ date: -1, spend: -1, calls: -1, qualified: -1 });
  const [importing, setImporting] = useState(false);

  const loadFile = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.length < 2) { toast.error("That file has no data rows."); return; }
      const hIdx = findHeaderRow(parsed);
      setRows(parsed);
      setHeaderIdx(hIdx);
      setMap(detectColumns(parsed[hIdx]));
    } catch {
      toast.error("Couldn't read that CSV.");
    }
  }, []);

  const header = rows?.[headerIdx] ?? [];

  // Parse data rows with the current mapping; drop rows whose date doesn't parse
  // (Google Ads preamble / totals / blank lines).
  const parsedRows = useMemo(() => {
    if (!rows || map.date < 0) return [];
    return rows.slice(headerIdx + 1).map(r => {
      const date = parseDate(r[map.date] ?? "");
      if (!date) return null;
      return {
        date,
        spend:           map.spend >= 0 ? parseNum(r[map.spend] ?? "") : 0,
        calls_total:     map.calls >= 0 ? Math.round(parseNum(r[map.calls] ?? "")) : 0,
        calls_qualified: map.qualified >= 0 ? Math.round(parseNum(r[map.qualified] ?? "")) : 0,
      };
    }).filter((x): x is NonNullable<typeof x> => x !== null);
  }, [rows, headerIdx, map]);

  const totals = useMemo(() => parsedRows.reduce(
    (a, r) => ({ spend: a.spend + r.spend, calls: a.calls + r.calls_total, qual: a.qual + r.calls_qualified }),
    { spend: 0, calls: 0, qual: 0 },
  ), [parsedRows]);

  async function doImport() {
    if (parsedRows.length === 0) { toast.error("No valid rows to import."); return; }
    setImporting(true);
    try {
      const res = await fetch("/api/daily-metrics/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc_id: docId, rows: parsedRows }),
      });
      const j = await res.json();
      if (j.ok) {
        toast.success(`Imported ${j.data.imported} day${j.data.imported !== 1 ? "s" : ""} · month totals updated`);
        reset();
        onImported?.();
      } else {
        toast.error(j.error ?? "Import failed");
      }
    } catch {
      toast.error("Import failed — check your connection.");
    } finally {
      setImporting(false);
    }
  }

  function reset() {
    setRows(null); setHeaderIdx(0); setMap({ date: -1, spend: -1, calls: -1, qualified: -1 });
    if (inputRef.current) inputRef.current.value = "";
  }

  const sel = (kind: ColKind, label: string, required?: boolean) => (
    <div>
      <label style={LABEL}>{label}{required && <span style={{ color: GOLD }}> *</span>}</label>
      <select
        value={map[kind]}
        onChange={e => setMap(m => ({ ...m, [kind]: Number(e.target.value) }))}
        style={{ ...css.inp, fontSize: 13, cursor: "pointer" }}
      >
        <option value={-1}>— none —</option>
        {header.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
      </select>
    </div>
  );

  return (
    <div>
      <input ref={inputRef} type="file" accept=".csv,text/csv" style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) void loadFile(f); }} />

      {!rows ? (
        <>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: MUTED, margin: "0 0 14px", lineHeight: 1.6 }}>
            Download a daily report from Google Ads (with Day, Cost, and Phone calls columns) and drop the CSV here.
            You&apos;ll preview every row before anything is saved.
          </p>
          <button onClick={() => inputRef.current?.click()} style={{ ...css.btnS, width: "100%" }}>
            Upload Google Ads CSV →
          </button>
        </>
      ) : (
        <>
          {/* Column mapping */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {sel("date", "Date column", true)}
            {sel("spend", "Spend column")}
            {sel("calls", "Calls column")}
            {sel("qualified", "Qualified column")}
          </div>

          {/* Preview */}
          {map.date < 0 ? (
            <div style={{ fontSize: 12, color: "#C96A6A", fontFamily: "var(--font-body)", marginBottom: 14 }}>
              Pick which column holds the date to preview the import.
            </div>
          ) : parsedRows.length === 0 ? (
            <div style={{ fontSize: 12, color: "#C96A6A", fontFamily: "var(--font-body)", marginBottom: 14 }}>
              No rows with a valid date were found. Check the date column.
            </div>
          ) : (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <span style={{ ...LABEL, marginBottom: 0 }}>Preview — {parsedRows.length} day{parsedRows.length !== 1 ? "s" : ""}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: GREEN }}>
                  {money(totals.spend)} · {totals.calls} calls · {totals.qual} qual.
                </span>
              </div>
              <div style={{ maxHeight: 200, overflowY: "auto", border: `1px solid ${BORDER}`, borderRadius: 8 }}>
                {parsedRows.slice(0, 60).map((r, i) => (
                  <div key={r.date + i} style={{
                    display: "grid", gridTemplateColumns: "1.4fr 1fr 0.8fr 0.8fr", gap: 8, padding: "7px 12px",
                    borderBottom: i < Math.min(parsedRows.length, 60) - 1 ? `1px solid rgba(243,241,236,0.05)` : "none",
                    fontFamily: "var(--font-mono)", fontSize: 11,
                  }}>
                    <span style={{ color: TEXT }}>{r.date}</span>
                    <span style={{ color: MUTED }}>{money(r.spend)}</span>
                    <span style={{ color: MUTED }}>{r.calls_total} calls</span>
                    <span style={{ color: MUTED }}>{r.calls_qualified} qual</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={reset} style={{ ...css.btnS, flex: "0 0 auto", padding: "12px 18px" }}>Cancel</button>
            <button onClick={doImport} disabled={importing || parsedRows.length === 0}
              style={{ ...css.btnP, flex: 1, opacity: importing || parsedRows.length === 0 ? 0.5 : 1 }}>
              {importing ? "Importing…" : `Import ${parsedRows.length} day${parsedRows.length !== 1 ? "s" : ""} →`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
