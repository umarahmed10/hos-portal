// Portal Dashboard — metrics lead when data exists; campaign status leads otherwise.
import { notFound, redirect } from "next/navigation";
import { getPortalSession }   from "@/lib/portal-auth";
import { getDocBySlug }       from "@/lib/data-access";
import { AutoRefresh }        from "@/components/client/AutoRefresh";
import { CountUp }            from "@/components/client/CountUp";
import { InsightStrip }       from "@/components/client/InsightStrip";
import { buildInsights }      from "@/lib/insights";
import { money, fmtDate, fmtDateShort } from "@/lib/utils";
import { MUTED, TEXT, GOLD } from "@/lib/styles";

export const metadata = { title: "Dashboard · HOS Client Portal" };

interface Props {
  params: Promise<{ slug: string }>;
}

const sL: React.CSSProperties = {
  fontFamily:    "var(--font-mono)",
  fontSize:      9,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color:         "#727272",
  marginBottom:  12,
};

const card: React.CSSProperties = {
  background:   "#1A1A1A",
  border:       "1px solid #2A2A2A",
  borderRadius: 10,
  padding:      "20px 24px",
  marginBottom: 16,
};

export default async function PortalDashboardPage({ params }: Props) {
  const { slug } = await params;
  const session  = await getPortalSession();
  if (!session || session.slug !== slug) redirect(`/portal/${slug}`);

  const doc = await getDocBySlug(slug);
  if (!doc) notFound();

  const callsTotal    = Number(doc.calls_total      ?? 0);
  const callsQual     = Number(doc.calls_qualified  ?? 0);
  const jobsBooked    = Number(doc.jobs_booked      ?? 0);
  const adSpend       = Number(doc.ad_spend         ?? 0);
  const avgJobValue   = Number(doc.avg_job_value    ?? 0);
  const monthlyBudget = Number(doc.monthly_budget   ?? 0);
  const ratePerCall   = Number(doc.rate_per_call    ?? 0);

  const isSigned    = doc.status === "signed";
  const isPaid      = doc.payment_status === "paid";
  const hasCallData = callsTotal > 0 || adSpend > 0;

  const qualRate    = callsTotal > 0 ? Math.round((callsQual / callsTotal) * 100) : 0;
  const costPerCall = callsTotal > 0 ? adSpend / callsTotal : 0;
  const costPerQual = callsQual  > 0 ? adSpend / callsQual  : 0;
  const budgetPct   = monthlyBudget > 0 ? Math.min(100, Math.round((adSpend / monthlyBudget) * 100)) : 0;
  const revenue     = jobsBooked * avgJobValue;
  const totalCost   = adSpend + (callsQual * ratePerCall);
  const netROI      = revenue - totalCost;

  const launchBase    = doc.signed_at ? new Date(doc.signed_at) : new Date(doc.created_at);
  const launchDate    = new Date(launchBase.getTime() + 48 * 3600 * 1000);
  const firstCallDate = new Date(launchBase.getTime() + 3  * 86400 * 1000);
  const lastCallDate  = new Date(launchBase.getTime() + 7  * 86400 * 1000);

  // The "daily read" — honest, system-generated intelligence briefing.
  const dailyRead = buildInsights({
    hasCallData, isPaid, callsTotal, callsQual, jobsBooked, qualRate,
    revenue, netROI, adSpend, monthlyBudget, ratePerCall, launchDate,
  });

  // Ownership framing — the portal is THEIRS, not ours.
  const firstName   = doc.name?.trim().split(/\s+/)[0] ?? "there";
  const growthTitle = doc.company ? `${doc.company} Growth Center` : `${firstName}'s Growth Center`;

  return (
    <div style={{ animation: "fadeIn 280ms var(--ease-out)" }} className="stagger">
      <AutoRefresh intervalMs={30000} />

      {/* Ownership header — this is your growth center */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: GOLD, marginBottom: 6 }}>
          {isPaid && hasCallData ? "Live" : isPaid ? "Deploying" : "Getting set up"}
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 400, fontSize: "clamp(26px, 4vw, 36px)", letterSpacing: "0.005em", color: TEXT, lineHeight: 1.1, margin: 0 }}>
          {growthTitle}
        </h1>
      </div>

      {/* Daily read — perceived intelligence */}
      <InsightStrip read={dailyRead} title="Daily read" />

      {hasCallData ? (
        /* ══════════════════════════════════════════
           ACTIVE STATE — metrics are the hero
        ══════════════════════════════════════════ */
        <>
          {/* 1 — ROI Hero */}
          {jobsBooked > 0 && avgJobValue > 0 && (
            <div style={{
              background:   "rgba(139,107,62,0.05)",
              border:       "1px solid rgba(139,107,62,0.18)",
              borderRadius: 12, padding: "28px 28px 24px", marginBottom: 16,
            }}>
              <div style={sL}>Your ROI · This Month</div>
              <CountUp
                value={netROI}
                money
                duration={1100}
                style={{
                  display: "block",
                  fontFamily: "var(--font-display)", fontStyle: "italic",
                  fontWeight: 300, fontSize: "clamp(48px, 7vw, 72px)",
                  letterSpacing: "-0.02em", color: TEXT, lineHeight: 1, marginBottom: 8,
                }}
              />
              <div style={{ fontFamily: "var(--font-body)", fontSize: 13, color: MUTED, lineHeight: 1.6 }}>
                {jobsBooked} jobs × {money(avgJobValue)} avg — {money(totalCost)} total spend
              </div>
            </div>
          )}

          {/* 2 — KPI Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            {[
              {
                label:  "Total Calls",
                num:    callsTotal, money: false,
                note:   `${qualRate}% qualified`,
                accent: true,  small: false,
              },
              {
                label:  "Qualified Calls",
                num:    callsQual, money: false,
                note:   callsTotal > 0 ? `${callsTotal - callsQual} not qualified` : "—",
                accent: false, small: false,
              },
              {
                label:  "Jobs Booked",
                num:    jobsBooked, money: false,
                note:   jobsBooked > 0 && avgJobValue > 0
                          ? `~${money(jobsBooked * avgJobValue)} est. revenue`
                          : "—",
                accent: false, small: false,
              },
              {
                label:  "Cost / Qualified Call",
                num:    costPerQual, money: true,
                note:   `${money(costPerCall)} per total call`,
                accent: false, small: true,
              },
            ].map(({ label, num, money: isMoney, note, accent, small }) => (
              <div key={label} style={{
                background:   "#1A1A1A",
                border:       "1px solid #2A2A2A",
                borderTop:    accent ? "2px solid #8B6B3E" : "1px solid #2A2A2A",
                borderRadius: 10, padding: "18px 20px 14px",
              }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, marginBottom: 8 }}>
                  {label}
                </div>
                <CountUp
                  value={num}
                  money={isMoney}
                  style={{ display: "block", fontFamily: "var(--font-ui)", fontSize: small ? 22 : 36, fontWeight: 600, letterSpacing: "-0.03em", color: TEXT, lineHeight: 1, marginBottom: 4 }}
                />
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#404040", letterSpacing: "0.06em" }}>
                  {note}
                </div>
              </div>
            ))}
          </div>

          {/* 3 — Budget bar */}
          {monthlyBudget > 0 && (
            <div style={card}>
              <div style={sL}>Budget</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                <div style={{ fontFamily: "var(--font-ui)", fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", color: TEXT }}>
                  <CountUp value={adSpend} money />
                  <span style={{ fontFamily: "var(--font-body)", fontSize: 13, color: MUTED, fontWeight: 400, marginLeft: 8 }}>
                    of {money(monthlyBudget)}
                  </span>
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: MUTED }}>
                  {money(Math.max(0, monthlyBudget - adSpend))} left
                </span>
              </div>
              <div style={{ height: 8, background: "#2A2A2A", borderRadius: 4, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 4,
                  width: `${budgetPct}%`,
                  background: budgetPct > 85 ? "#D4926A" : "#8B6B3E",
                  transition: "width 600ms var(--ease-out)",
                }} />
              </div>
            </div>
          )}

          {/* 4 — Infrastructure Status */}
          {isPaid && (
            <div style={card}>
              <div style={sL}>Infrastructure Status</div>
              {[
                { label: "Google Ads",       active: true        },
                { label: "Call Tracking",    active: true        },
                { label: "Call Routing",     active: true        },
                { label: "Weekly Reporting", active: hasCallData },
              ].map(({ label, active }, i, arr) => (
                <div key={label} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 0",
                  borderBottom: i < arr.length - 1 ? "1px solid rgba(243,241,236,0.05)" : "none",
                }}>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: 14, color: TEXT }}>{label}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: active ? "#4EAD87" : "#727272" }} />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: active ? "#4EAD87" : "#727272" }}>
                      {active ? "Active" : "Pending"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 5 — Campaign milestones — minimal, bottom */}
          <div style={{ padding: "16px 0", borderTop: "1px solid rgba(243,241,236,0.06)", marginTop: 8 }}>
            <div style={{ ...sL, marginBottom: 10 }}>Campaign</div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {["Agreement signed", "Payment received", "Campaign deploying", "First calls live"].map(label => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="9" height="8" viewBox="0 0 8 7" fill="none" style={{ flexShrink: 0 }}>
                    <polyline points="1,3.5 3,5.5 7,1" stroke="#4EAD87" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em", color: "#404040", textTransform: "uppercase" }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        /* ══════════════════════════════════════════
           PRE-DATA STATE — campaign status is all there is
        ══════════════════════════════════════════ */
        <>
          {/* Campaign Status Card */}
          <div style={{
            background: "rgba(139,107,62,0.04)", border: "1px solid rgba(139,107,62,0.15)",
            borderRadius: 12, padding: "24px 28px", marginBottom: 16,
          }}>
            <div style={sL}>Campaign Status</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {[
                { label: "Agreement signed",   done: isSigned,                           pulse: false                      },
                { label: "Payment received",   done: isPaid,                             pulse: false                      },
                { label: "Campaign deploying", done: isPaid,                             pulse: isPaid && !hasCallData      },
                { label: "First calls live",   done: hasCallData,                        pulse: false                      },
              ].map(({ label, done, pulse }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                    background: done ? "rgba(78,173,135,0.15)" : "rgba(243,241,236,0.04)",
                    border:     done ? "1px solid rgba(78,173,135,0.4)" : "1px solid rgba(243,241,236,0.1)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    animation: pulse ? "pulseGold 2s infinite" : "none",
                  }}>
                    {done && (
                      <svg width="8" height="7" viewBox="0 0 8 7" fill="none">
                        <polyline points="1,3.5 3,5.5 7,1" stroke="#4EAD87" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: 14, color: done ? TEXT : MUTED, fontWeight: done ? 500 : 400 }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {isSigned && !hasCallData && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, paddingTop: 16, borderTop: "1px solid rgba(243,241,236,0.06)" }}>
                {[
                  { label: "Campaign Launch", value: isPaid ? fmtDate(launchDate) : "After payment" },
                  { label: "First Calls",     value: isPaid ? `${fmtDateShort(firstCallDate)} – ${fmtDateShort(lastCallDate)}` : "3–7 days after launch" },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 500, color: TEXT }}>{value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Infrastructure Status */}
          {isPaid && (
            <div style={card}>
              <div style={sL}>Infrastructure Status</div>
              {[
                { label: "Google Ads",       active: true  },
                { label: "Call Tracking",    active: true  },
                { label: "Call Routing",     active: true  },
                { label: "Weekly Reporting", active: false },
              ].map(({ label, active }, i, arr) => (
                <div key={label} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 0",
                  borderBottom: i < arr.length - 1 ? "1px solid rgba(243,241,236,0.05)" : "none",
                }}>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: 14, color: TEXT }}>{label}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: active ? "#4EAD87" : "#727272" }} />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: active ? "#4EAD87" : "#727272" }}>
                      {active ? "Active" : "Pending"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Placeholder metrics */}
          <div style={{ ...card, textAlign: "center", padding: "32px 24px" }}>
            <div style={sL}>Calls &amp; Performance</div>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: MUTED, lineHeight: 1.7, margin: 0 }}>
              Call data appears here once your campaign is live.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
