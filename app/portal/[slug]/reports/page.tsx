// Portal Reports tab — weekly rollups computed from real daily_metrics.
// Falls back to an honest forward-looking state when no daily data exists yet.
import { notFound, redirect } from "next/navigation";
import { getPortalSession }   from "@/lib/portal-auth";
import { getDocBySlug }       from "@/lib/data-access";
import { createClient }       from "@supabase/supabase-js";
import { money }              from "@/lib/utils";
import { BODY, BORDER, FONT, MUTED, TEXT, GOLD, GREEN, css } from "@/lib/styles";

interface Props {
  params: Promise<{ slug: string }>;
}

interface DailyMetric {
  date:            string;
  spend:           number | null;
  calls_total:     number | null;
  calls_qualified: number | null;
}

interface WeekRollup {
  weekStart: string;   // YYYY-MM-DD (Monday)
  label:     string;   // "Jul 14 – Jul 20"
  days:      number;
  spend:     number;
  calls:     number;
  qualified: number;
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
    .limit(120);
  return (data ?? []) as DailyMetric[];
}

function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay(); // 0 Sun … 6 Sat
  d.setDate(d.getDate() - ((day + 6) % 7));
  return d.toISOString().split("T")[0];
}

function fmtShort(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function rollupWeeks(metrics: DailyMetric[]): WeekRollup[] {
  const weeks = new Map<string, WeekRollup>();
  for (const m of metrics) {
    const ws = mondayOf(m.date);
    let w = weeks.get(ws);
    if (!w) {
      const end = new Date(ws + "T12:00:00");
      end.setDate(end.getDate() + 6);
      w = { weekStart: ws, label: `${fmtShort(ws)} – ${fmtShort(end.toISOString().split("T")[0])}`, days: 0, spend: 0, calls: 0, qualified: 0 };
      weeks.set(ws, w);
    }
    w.days      += 1;
    w.spend     += Number(m.spend ?? 0);
    w.calls     += Number(m.calls_total ?? 0);
    w.qualified += Number(m.calls_qualified ?? 0);
  }
  return [...weeks.values()].sort((a, b) => b.weekStart.localeCompare(a.weekStart)).slice(0, 8);
}

const sL: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.14em",
  textTransform: "uppercase", color: MUTED, marginBottom: 12,
};

export default async function PortalReportsPage({ params }: Props) {
  const { slug } = await params;
  const session  = await getPortalSession();
  if (!session || session.slug !== slug) redirect(`/portal/${slug}`);

  const doc = await getDocBySlug(slug);
  if (!doc) notFound();

  const metrics = await getDailyMetrics(doc.id);
  const weeks   = rollupWeeks(metrics);
  const best    = weeks.reduce<WeekRollup | null>((m, w) => (m === null || w.qualified > m.qualified ? w : m), null);

  return (
    <div style={{ animation: "fadeIn 280ms var(--ease-out)" }} className="stagger">
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, letterSpacing: "1.5px", fontWeight: 700, color: MUTED, fontFamily: BODY, marginBottom: 8 }}>
          CALL REPORTS
        </div>
        <h2 style={{ fontFamily: FONT, fontSize: 28, fontWeight: 700, letterSpacing: "-0.4px", color: TEXT, marginBottom: 8 }}>
          Weekly performance
        </h2>
        <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.7, maxWidth: 480, margin: 0 }}>
          {weeks.length > 0
            ? "Week-by-week rollups of your call volume, qualification, and spend."
            : "Weekly summaries appear here as your campaign generates daily call data."}
        </p>
      </div>

      {weeks.length === 0 ? (
        <div style={{ ...css.card, padding: "44px 32px", textAlign: "center" }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%",
            border: "1px solid rgba(139,107,62,0.2)", background: "rgba(139,107,62,0.06)",
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px",
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round">
              <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </div>
          <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.7, maxWidth: 340, margin: "0 auto" }}>
            Your first weekly report builds automatically from daily call data —
            typically within the first week after launch.
          </p>
        </div>
      ) : (
        <>
          {weeks.map((w, i) => {
            const isBest = best !== null && w.weekStart === best.weekStart && weeks.length > 1 && w.qualified > 0;
            const costPerQual = w.qualified > 0 ? w.spend / w.qualified : 0;
            const qualRate = w.calls > 0 ? Math.round((w.qualified / w.calls) * 100) : 0;
            return (
              <div key={w.weekStart} style={{
                background: "#1A1A1A",
                border: `1px solid ${isBest ? "rgba(78,173,135,0.3)" : BORDER}`,
                borderRadius: 10, padding: "18px 22px", marginBottom: 10,
              }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: TEXT }}>
                    {w.label}
                  </span>
                  {i === 0 && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, letterSpacing: "0.1em", textTransform: "uppercase", color: GOLD, border: "1px solid rgba(139,107,62,0.3)", background: "rgba(139,107,62,0.08)", borderRadius: 12, padding: "2px 8px" }}>
                      Latest
                    </span>
                  )}
                  {isBest && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, letterSpacing: "0.1em", textTransform: "uppercase", color: GREEN, border: "1px solid rgba(78,173,135,0.3)", background: "rgba(78,173,135,0.08)", borderRadius: 12, padding: "2px 8px" }}>
                      Best week
                    </span>
                  )}
                  <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10, color: MUTED }}>
                    {w.days} day{w.days !== 1 ? "s" : ""} logged
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10 }}>
                  {[
                    { l: "Calls",       v: String(w.calls) },
                    { l: "Qualified",   v: `${w.qualified}${w.calls > 0 ? ` (${qualRate}%)` : ""}` },
                    { l: "Spend",       v: money(w.spend) },
                    { l: "Cost / Qual", v: w.qualified > 0 ? money(costPerQual) : "—" },
                  ].map(({ l, v }) => (
                    <div key={l}>
                      <div style={sL}>{l}</div>
                      <div style={{ fontFamily: "var(--font-ui)", fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em", color: TEXT, marginTop: -6 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
