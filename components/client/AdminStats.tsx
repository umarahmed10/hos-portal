"use client";
import { useState }  from "react";
import { useRouter } from "next/navigation";
import { toast }     from "sonner";
import { money }     from "@/lib/utils";
import { css, BORDER, MUTED, TEXT } from "@/lib/styles";
import { HOSLogo }   from "@/components/shared/HOSLogo";
import type { Doc }  from "@/types";

interface DailyEntry {
  id?:             string;
  date:            string;
  spend:           number | null;
  calls_total:     number | null;
  calls_qualified: number | null;
}

interface Props {
  doc:            Doc;
  initialMetrics: DailyEntry[];
}

const LABEL: React.CSSProperties = {
  fontFamily:    "var(--font-mono)",
  fontSize:      9,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color:         MUTED,
  marginBottom:  6,
  display:       "block",
};

const INP: React.CSSProperties = {
  ...css.inp,
  fontSize: "max(16px, 14px)",
};

const SECTION_TITLE: React.CSSProperties = {
  fontFamily:    "var(--font-mono)",
  fontSize:      9,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color:         "rgba(139,107,62,0.6)",
  marginBottom:  16,
  paddingBottom: 10,
  borderBottom:  "1px solid rgba(243,241,236,0.06)",
};

export function AdminStats({ doc, initialMetrics }: Props) {
  const router = useRouter();

  // Monthly settings
  const [budget, setBudget] = useState(String(doc.monthly_budget   ?? ""));
  const [cap,    setCap]    = useState(String(doc.monthly_call_cap ?? ""));
  const [rate,   setRate]   = useState(String(doc.rate_per_call    ?? ""));
  const [avgJob, setAvgJob] = useState(String(doc.avg_job_value    ?? ""));

  // Monthly totals
  const [total,  setTotal]  = useState(String(doc.calls_total     ?? ""));
  const [qual,   setQual]   = useState(String(doc.calls_qualified ?? ""));
  const [jobs,   setJobs]   = useState(String(doc.jobs_booked     ?? ""));
  const [spend,  setSpend]  = useState(String(doc.ad_spend        ?? ""));

  const [saving, setSaving] = useState(false);

  // Daily entry
  const [metrics,  setMetrics]  = useState<DailyEntry[]>(initialMetrics);
  const [dayDate,  setDayDate]  = useState(new Date().toISOString().split("T")[0]);
  const [daySpend, setDaySpend] = useState("");
  const [dayCalls, setDayCalls] = useState("");
  const [dayQual,  setDayQual]  = useState("");
  const [savingDay, setSavingDay] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/docs/${doc.code}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthly_budget:   budget ? Number(budget) : undefined,
          monthly_call_cap: cap    ? Number(cap)    : undefined,
          rate_per_call:    rate   ? Number(rate)   : undefined,
          avg_job_value:    avgJob ? Number(avgJob) : undefined,
          calls_total:      total  ? Number(total)  : undefined,
          calls_qualified:  qual   ? Number(qual)   : undefined,
          jobs_booked:      jobs   ? Number(jobs)   : undefined,
          ad_spend:         spend  ? Number(spend)  : undefined,
        }),
      });
      const json = await res.json();
      if (json.ok) toast.success("Stats saved");
      else         toast.error(json.error ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddDay() {
    if (!dayDate) return;
    setSavingDay(true);
    try {
      const res = await fetch("/api/daily-metrics", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc_id:          doc.id,
          date:            dayDate,
          spend:           daySpend ? Number(daySpend) : 0,
          calls_total:     dayCalls ? Number(dayCalls) : 0,
          calls_qualified: dayQual  ? Number(dayQual)  : 0,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        toast.success(`${dayDate} saved`);
        setMetrics(prev => {
          const entry: DailyEntry = {
            date:            dayDate,
            spend:           daySpend ? Number(daySpend) : 0,
            calls_total:     dayCalls ? Number(dayCalls) : 0,
            calls_qualified: dayQual  ? Number(dayQual)  : 0,
          };
          const idx = prev.findIndex(m => m.date === dayDate);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx]  = entry;
            return updated;
          }
          return [entry, ...prev].sort((a, b) => b.date.localeCompare(a.date));
        });
        setDaySpend(""); setDayCalls(""); setDayQual("");
        const next = new Date(dayDate);
        next.setDate(next.getDate() + 1);
        setDayDate(next.toISOString().split("T")[0]);
      } else {
        toast.error(json.error ?? "Failed");
      }
    } finally {
      setSavingDay(false);
    }
  }

  const sCard: React.CSSProperties = {
    background:   "#1A1A1A",
    border:       `1px solid ${BORDER}`,
    borderRadius: 10,
    padding:      "24px 24px 20px",
    marginBottom: 16,
  };

  const twoCol: React.CSSProperties = {
    display:             "grid",
    gridTemplateColumns: "1fr 1fr",
    gap:                 12,
  };

  return (
    <div style={{ ...css.app, minHeight: "100vh" }}>

      {/* Top bar */}
      <div style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div style={{
          maxWidth: 760, margin: "0 auto", padding: "14px 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => router.push("/admin")}
              style={{ ...css.btnS, padding: "8px 14px", fontSize: 12 }}
            >
              ← Dashboard
            </button>
            <HOSLogo size={22} theme="dark" showWordmark={false} />
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED }}>
                Campaign Stats
              </div>
              <div style={{ fontFamily: "var(--font-ui)", fontSize: 18, fontWeight: 600, color: TEXT, letterSpacing: "-0.2px" }}>
                {doc.name}
                {doc.company && (
                  <span style={{ color: MUTED, fontWeight: 400, fontSize: 14, marginLeft: 8 }}>{doc.company}</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => router.push(`/admin/share?code=${doc.code}`)}
            style={{ ...css.btnS, padding: "8px 16px", fontSize: 12 }}
          >
            Share Page
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 24px 80px" }}>

        {/* Monthly Settings */}
        <div style={sCard}>
          <div style={SECTION_TITLE}>Monthly Settings</div>
          <div className="perf-two-col" style={twoCol}>
            <div>
              <label style={LABEL}>Monthly Budget ($)</label>
              <input type="number" min="0" step="50" value={budget}
                onChange={e => setBudget(e.target.value)} placeholder="e.g. 2000" style={INP} />
            </div>
            <div>
              <label style={LABEL}>Rate Per Qualified Call ($)</label>
              <input type="number" min="0" step="5" value={rate}
                onChange={e => setRate(e.target.value)} placeholder="e.g. 75" style={INP} />
            </div>
            <div>
              <label style={LABEL}>Monthly Call Cap (included)</label>
              <input type="number" min="0" value={cap}
                onChange={e => setCap(e.target.value)} placeholder="e.g. 20" style={INP} />
            </div>
            <div>
              <label style={LABEL}>Avg Job Value ($)</label>
              <input type="number" min="0" step="50" value={avgJob}
                onChange={e => setAvgJob(e.target.value)} placeholder="e.g. 500" style={INP} />
            </div>
          </div>
        </div>

        {/* This Month Totals */}
        <div style={sCard}>
          <div style={SECTION_TITLE}>This Month — Totals</div>
          <div className="perf-two-col" style={twoCol}>
            <div>
              <label style={LABEL}>Total Calls</label>
              <input type="number" min="0" value={total}
                onChange={e => setTotal(e.target.value)} placeholder="0" style={INP} />
            </div>
            <div>
              <label style={LABEL}>Qualified Calls</label>
              <input type="number" min="0" value={qual}
                onChange={e => setQual(e.target.value)} placeholder="0" style={INP} />
            </div>
            <div>
              <label style={LABEL}>Jobs Booked</label>
              <input type="number" min="0" value={jobs}
                onChange={e => setJobs(e.target.value)} placeholder="0" style={INP} />
            </div>
            <div>
              <label style={LABEL}>Ad Spend ($)</label>
              <input type="number" min="0" step="10" value={spend}
                onChange={e => setSpend(e.target.value)} placeholder="0.00" style={INP} />
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ ...css.btnP, width: "100%", marginTop: 16, opacity: saving ? 0.6 : 1 }}
          >
            {saving ? "Saving…" : "SAVE →"}
          </button>
        </div>

        {/* Daily Entry */}
        <div style={sCard}>
          <div style={SECTION_TITLE}>Daily Entry</div>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: MUTED, margin: "0 0 14px", lineHeight: 1.5 }}>
            Log each day individually. Same date = auto-update. Date advances by 1 after each save.
          </p>
          <div className="perf-daily-row" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 10, alignItems: "end" }}>
            <div className="date-col">
              <label style={LABEL}>Date</label>
              <input type="date" value={dayDate} onChange={e => setDayDate(e.target.value)} style={INP} />
            </div>
            <div>
              <label style={LABEL}>Spend $</label>
              <input type="number" min="0" value={daySpend}
                onChange={e => setDaySpend(e.target.value)} placeholder="0" style={INP} />
            </div>
            <div>
              <label style={LABEL}>Calls</label>
              <input type="number" min="0" value={dayCalls}
                onChange={e => setDayCalls(e.target.value)} placeholder="0" style={INP} />
            </div>
            <div>
              <label style={LABEL}>Qual.</label>
              <input type="number" min="0" value={dayQual}
                onChange={e => setDayQual(e.target.value)} placeholder="0" style={INP} />
            </div>
          </div>
          <button
            onClick={handleAddDay}
            disabled={savingDay || !dayDate}
            style={{ ...css.btnS, width: "100%", marginTop: 10, opacity: savingDay ? 0.6 : 1 }}
          >
            {savingDay ? "Saving…" : `ADD ${dayDate} →`}
          </button>
        </div>

        {/* Recent entries */}
        {metrics.length > 0 && (
          <div style={sCard}>
            <div style={SECTION_TITLE}>Recent Daily Entries</div>
            {metrics.slice(0, 14).map(({ date, spend: s, calls_total: ct, calls_qualified: cq }, i) => (
              <div key={date} style={{
                display: "flex", gap: 12, padding: "9px 0", alignItems: "center",
                borderBottom: i < Math.min(metrics.length, 14) - 1 ? `1px solid rgba(243,241,236,0.05)` : "none",
              }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: MUTED, minWidth: 80 }}>
                  {new Date(date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
                {[
                  { k: "Spend", v: money(s  ?? 0)  },
                  { k: "Calls", v: String(ct ?? 0) },
                  { k: "Qual",  v: String(cq ?? 0) },
                ].map(({ k, v }) => (
                  <div key={k} style={{ display: "flex", gap: 4, alignItems: "baseline" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#404040", textTransform: "uppercase", letterSpacing: "0.08em" }}>{k}</span>
                    <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 500, color: TEXT }}>{v}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
