// Portal Calls page — budget progress + metrics + daily breakdown.
import { notFound, redirect } from "next/navigation";
import { getPortalSession }   from "@/lib/portal-auth";
import { getDocBySlug }       from "@/lib/data-access";
import { AutoRefresh }        from "@/components/client/AutoRefresh";
import { createClient }       from "@supabase/supabase-js";
import { money }              from "@/lib/utils";
import { BORDER, MUTED, TEXT } from "@/lib/styles";

interface Props {
  params: Promise<{ slug: string }>;
}

interface DailyMetric {
  date:            string;
  spend:           number | null;
  calls_total:     number | null;
  calls_qualified: number | null;
}

async function getDailyMetrics(docId: string): Promise<DailyMetric[]> {
  const url    = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !svcKey) return [];

  const db = createClient(url, svcKey, { auth: { persistSession: false } });
  const { data } = await db
    .from("daily_metrics")
    .select("date, spend, calls_total, calls_qualified")
    .eq("doc_id", docId)
    .order("date", { ascending: false })
    .limit(31);

  return (data ?? []) as DailyMetric[];
}

const sectionLabel: React.CSSProperties = {
  fontFamily:    "var(--font-mono)",
  fontSize:      9,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color:         "#727272",
  marginBottom:  12,
};

export default async function PortalPerformancePage({ params }: Props) {
  const { slug } = await params;
  const session  = await getPortalSession();
  if (!session || session.slug !== slug) redirect(`/portal/${slug}`);

  const doc = await getDocBySlug(slug);
  if (!doc) notFound();

  const metrics = await getDailyMetrics(doc.id);

  const callsTotal    = Number(doc.calls_total      ?? 0);
  const callsQual     = Number(doc.calls_qualified  ?? 0);
  const adSpend       = Number(doc.ad_spend         ?? 0);
  const monthlyBudget = Number(doc.monthly_budget   ?? 0);
  const callCap       = Number(doc.monthly_call_cap ?? 0);
  const hasData       = callsTotal > 0 || adSpend > 0;

  const budgetPct   = monthlyBudget > 0 ? Math.min(100, Math.round((adSpend / monthlyBudget) * 100)) : 0;
  const qualRate    = callsTotal > 0 ? Math.round((callsQual / callsTotal) * 100) : 0;
  const costPerCall = callsTotal > 0 ? adSpend / callsTotal : 0;
  const costPerQual = callsQual  > 0 ? adSpend / callsQual  : 0;
  const overage     = callCap > 0 ? Math.max(0, callsQual - callCap) : 0;

  return (
    <div style={{ animation: "fadeIn 280ms var(--ease-out)" }} className="stagger">
      <AutoRefresh intervalMs={60000} />

      {/* Budget card */}
      {monthlyBudget > 0 ? (
        <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 10, padding: "20px 24px", marginBottom: 16 }}>
          <div style={sectionLabel}>Monthly Budget</div>
          <div style={{ fontFamily: "var(--font-ui)", fontSize: 36, fontWeight: 600, letterSpacing: "-0.03em", color: TEXT, lineHeight: 1, marginBottom: 4 }}>
            {money(adSpend)}
            <span style={{ fontFamily: "var(--font-body)", fontSize: 14, color: MUTED, fontWeight: 400, marginLeft: 10 }}>/ {money(monthlyBudget)}</span>
          </div>
          <div style={{ height: 10, background: "#2A2A2A", borderRadius: 5, margin: "14px 0 8px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${budgetPct}%`, background: budgetPct > 85 ? "#D4926A" : "#8B6B3E", borderRadius: 5, transition: "width 600ms var(--ease-out)" }} />
          </div>
          <div style={{ fontFamily: "var(--font-body)", fontSize: 13, color: MUTED }}>
            {money(Math.max(0, monthlyBudget - adSpend))} remaining · {budgetPct}% used
          </div>
        </div>
      ) : (
        <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 10, padding: "20px 24px", marginBottom: 16, textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: MUTED, margin: 0 }}>Budget not yet configured.</p>
        </div>
      )}

      {/* KPI row */}
      {hasData && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
          {[
            { label: "Total Calls",  value: callsTotal.toString()          },
            { label: "Qualified",    value: `${callsQual} (${qualRate}%)`  },
            { label: callCap > 0 ? "Over Cap" : "Jobs Booked",
              value: callCap > 0 ? overage.toString() : String(doc.jobs_booked ?? 0) },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: "#1A1A1A", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "16px 18px 12px" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, marginBottom: 8 }}>{label}</div>
              <div style={{ fontFamily: "var(--font-ui)", fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", color: TEXT, lineHeight: 1.1 }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Cost metrics */}
      {hasData && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {[
            { label: "Cost Per Call",          value: money(costPerCall) },
            { label: "Cost Per Qualified Call", value: money(costPerQual) },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: "#1A1A1A", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "16px 18px 12px" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, marginBottom: 8 }}>{label}</div>
              <div style={{ fontFamily: "var(--font-ui)", fontSize: 22, fontWeight: 600, color: TEXT }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Daily breakdown */}
      {metrics.length > 0 && (
        <div style={{ background: "#1A1A1A", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "20px 24px" }}>
          <div style={sectionLabel}>Daily Breakdown</div>
          {metrics.map(({ date, spend, calls_total: ct, calls_qualified: cq }, i) => (
            <div key={date} style={{
              display: "flex", gap: 16, padding: "10px 0", flexWrap: "wrap",
              borderBottom: i < metrics.length - 1 ? "1px solid rgba(243,241,236,0.05)" : "none",
            }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: MUTED, minWidth: 72 }}>
                {new Date(date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
              <div style={{ display: "flex", gap: 20, flex: 1, flexWrap: "wrap" }}>
                {[
                  { k: "Spend",     v: money(spend ?? 0)  },
                  { k: "Calls",     v: String(ct ?? 0)    },
                  { k: "Qualified", v: String(cq ?? 0)    },
                ].map(({ k, v }) => (
                  <div key={k} style={{ display: "flex", gap: 5, alignItems: "baseline" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#404040", letterSpacing: "0.1em", textTransform: "uppercase" }}>{k}</span>
                    <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 500, color: TEXT }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!hasData && metrics.length === 0 && (
        <div style={{ background: "#1A1A1A", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "40px 24px", textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: MUTED, lineHeight: 1.7, margin: 0 }}>
            Call data appears here once your campaign is live. Typically 3–7 days after launch.
          </p>
        </div>
      )}
    </div>
  );
}
