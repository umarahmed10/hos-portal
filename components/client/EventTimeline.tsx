"use client";
import { useMemo, useState } from "react";
import { fmtDateTime } from "@/lib/utils";
import { BODY, BORDER, MUTED, TEXT, GOLD, GREEN, RED } from "@/lib/styles";
import { getEventMeta } from "@/lib/operational-events";
import type { DocEvent } from "@/types";

interface Props { events: DocEvent[] }

const FUNNEL_STAGES = [
  { key: "created",         label: "Created" },
  { key: "email_sent",      label: "Emailed" },
  { key: "viewed",          label: "Viewed" },
  { key: "signed",          label: "Signed" },
  { key: "payment_updated", label: "Paid" },
] as const;

function fmtDuration(ms: number): string {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ${sec % 60}s`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ${min % 60}m`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h`;
}

export function EventTimeline({ events }: Props) {
  const [view, setView] = useState<"journey" | "log">("journey");

  const a = useMemo(() => {
    if (events.length === 0) return null;
    const sorted = [...events].sort((x, y) => new Date(x.created_at).getTime() - new Date(y.created_at).getTime());

    const counts: Record<string, number> = {};
    const firstAt: Record<string, string> = {};
    for (const e of sorted) {
      counts[e.event_type] = (counts[e.event_type] || 0) + 1;
      if (!firstAt[e.event_type]) firstAt[e.event_type] = e.created_at;
    }

    const stages = FUNNEL_STAGES.map(s => ({ ...s, count: counts[s.key] || 0, reached: !!firstAt[s.key], at: firstAt[s.key] || null }));

    const transitions: { from: string; to: string; ms: number }[] = [];
    for (let i = 0; i < stages.length - 1; i++) {
      const f = stages[i], t = stages[i + 1];
      if (f.at && t.at) transitions.push({ from: f.label, to: t.label, ms: new Date(t.at).getTime() - new Date(f.at).getTime() });
    }

    const reached      = stages.filter(s => s.reached);
    const lastReached  = reached[reached.length - 1] ?? null;
    const converted    = stages.find(s => s.key === "payment_updated")?.reached ?? false;
    const signed       = stages.find(s => s.key === "signed")?.reached ?? false;
    const friction     = transitions.length ? transitions.reduce((m, x) => (x.ms > m.ms ? x : m)) : null;
    const createdAt    = stages[0].at;
    const totalMs      = createdAt && lastReached?.at ? new Date(lastReached.at).getTime() - new Date(createdAt).getTime() : 0;
    const lastEventMs  = Date.now() - new Date(sorted[sorted.length - 1].created_at).getTime();
    const views        = counts["viewed"] || 0;
    const invoiceViews = counts["invoice_viewed"] || 0;

    const consideration = views >= 11 ? "high consideration" : views >= 4 ? "reviewed carefully" : "decisive";

    // Verdict
    let verdict: { title: string; sub: string; tone: "green" | "gold" | "red" };
    if (converted) {
      verdict = { title: "Converted", tone: "green",
        sub: `Signed & paid in ${fmtDuration(totalMs)} · ${views} open${views !== 1 ? "s" : ""} (${consideration}).` };
    } else if (signed) {
      verdict = { title: "Signed — awaiting payment", tone: "gold",
        sub: `Reached signing in ${fmtDuration(totalMs)}. No payment yet — last activity ${fmtDuration(lastEventMs)} ago.` };
    } else {
      const stalledLong = lastEventMs > 3 * 24 * 60 * 60 * 1000;
      verdict = { title: `Stalled at "${lastReached?.label ?? "Created"}"`, tone: stalledLong ? "red" : "gold",
        sub: `${views} open${views !== 1 ? "s" : ""} (${consideration}) · no movement for ${fmtDuration(lastEventMs)}.` };
    }

    return { stages, transitions, friction, verdict, views, invoiceViews, total: events.length };
  }, [events]);

  if (events.length === 0) {
    return <div style={{ color: MUTED, fontSize: 12, fontFamily: BODY, padding: "12px 0" }}>No events recorded yet.</div>;
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        {(["journey", "log"] as const).map(v => (
          <button key={v} onClick={() => setView(v)} style={{
            padding: "4px 10px", borderRadius: 4, fontSize: 10, fontFamily: "var(--font-mono)",
            letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer",
            background: view === v ? "rgba(139,107,62,0.15)" : "transparent",
            color: view === v ? GOLD : MUTED,
            border: view === v ? `1px solid rgba(139,107,62,0.3)` : `1px solid ${BORDER}`,
          }}>{v === "journey" ? "Journey" : "Log"}</button>
        ))}
      </div>

      {view === "journey" && a ? (
        <div>
          {/* Verdict */}
          <div style={{
            padding: "12px 14px", borderRadius: 10, marginBottom: 16,
            background: a.verdict.tone === "green" ? "rgba(78,173,135,0.08)" : a.verdict.tone === "red" ? "rgba(201,106,106,0.08)" : "rgba(139,107,62,0.08)",
            border: `1px solid ${a.verdict.tone === "green" ? "rgba(78,173,135,0.25)" : a.verdict.tone === "red" ? "rgba(201,106,106,0.25)" : "rgba(139,107,62,0.25)"}`,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--font-ui)", color: a.verdict.tone === "green" ? GREEN : a.verdict.tone === "red" ? RED : GOLD, marginBottom: 3 }}>
              {a.verdict.title}
            </div>
            <div style={{ fontSize: 12, color: MUTED, fontFamily: BODY, lineHeight: 1.5 }}>{a.verdict.sub}</div>
          </div>

          {/* Journey stepper */}
          <div style={{ position: "relative" }}>
            {a.stages.map((s, i) => {
              const trans = i > 0 ? a.transitions.find(t => t.to === s.label) : null;
              const isFriction = !!(trans && a.friction && trans.ms === a.friction.ms && a.transitions.length > 1);
              return (
                <div key={s.key}>
                  {/* connector with elapsed time */}
                  {i > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, height: 26, paddingLeft: 5 }}>
                      <div style={{ width: 2, height: "100%", background: s.reached ? "rgba(78,173,135,0.35)" : BORDER }} />
                      {trans && (
                        <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: isFriction ? RED : MUTED, fontWeight: isFriction ? 600 : 400 }}>
                          {fmtDuration(trans.ms)}{isFriction ? "  ← longest wait" : ""}
                        </span>
                      )}
                    </div>
                  )}
                  {/* node */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 12, height: 12, borderRadius: "50%", flexShrink: 0,
                      background: s.reached ? GREEN : "transparent",
                      border: s.reached ? "none" : `2px solid ${BORDER}`,
                      boxShadow: s.reached ? `0 0 0 3px rgba(78,173,135,0.15)` : "none",
                    }} />
                    <div style={{ flex: 1, display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: s.reached ? 600 : 400, color: s.reached ? TEXT : MUTED, fontFamily: "var(--font-ui)" }}>{s.label}</span>
                      {s.count > 1 && (
                        <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: GOLD, background: "rgba(139,107,62,0.12)", border: "1px solid rgba(139,107,62,0.25)", borderRadius: 10, padding: "1px 7px", letterSpacing: "0.04em" }}>
                          {s.count}×{s.key === "viewed" ? " opens" : ""}
                        </span>
                      )}
                      <span style={{ marginLeft: "auto", fontSize: 10, color: MUTED, fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                        {s.at ? fmtDateTime(s.at) : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Engagement footer */}
          <div style={{ display: "flex", gap: 20, paddingTop: 14, marginTop: 14, borderTop: `1px solid ${BORDER}` }}>
            <Stat n={a.views} label="Doc opens" />
            <Stat n={a.invoiceViews} label="Invoice opens" />
            <Stat n={a.total} label="Total events" />
          </div>
        </div>
      ) : (
        <LogView events={events} />
      )}
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, color: TEXT, fontFamily: "var(--font-ui)", letterSpacing: "-0.02em", lineHeight: 1 }}>{n}</div>
      <div style={{ fontSize: 9, color: MUTED, fontFamily: "var(--font-mono)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 4 }}>{label}</div>
    </div>
  );
}

function LogView({ events }: { events: DocEvent[] }) {
  return (
    <div style={{ position: "relative" }}>
      {events.map((evt, i) => {
        const meta = getEventMeta(evt.event_type);
        const isLast = i === events.length - 1;
        return (
          <div key={evt.id} style={{ display: "flex", gap: 12, paddingBottom: isLast ? 0 : 10 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 16 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: meta.color, flexShrink: 0, marginTop: 5 }} />
              {!isLast && <div style={{ width: 1, flex: 1, background: BORDER, marginTop: 2, minHeight: 10 }} />}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 500, color: TEXT, fontFamily: BODY }}>{meta.label}</div>
              <div style={{ fontSize: 10, color: MUTED, fontFamily: "var(--font-mono)" }}>{fmtDateTime(evt.created_at)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
