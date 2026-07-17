"use client";
import { useMemo, useState } from "react";
import { fmtDateTime } from "@/lib/utils";
import { BODY, BORDER, MUTED, SURF_2, TEXT, GOLD, GREEN, RED } from "@/lib/styles";
import { getEventMeta } from "@/lib/operational-events";
import type { DocEvent } from "@/types";

interface Props {
  events: DocEvent[];
}

const FUNNEL_STAGES = [
  { key: "created",        label: "Created" },
  { key: "email_sent",     label: "Email sent" },
  { key: "viewed",         label: "Viewed" },
  { key: "signed",         label: "Signed" },
  { key: "payment_updated", label: "Paid" },
] as const;

function fmtDuration(ms: number): string {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ${min % 60}m`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h`;
}

export function EventTimeline({ events }: Props) {
  const [view, setView] = useState<"funnel" | "log">("funnel");

  const analysis = useMemo(() => {
    if (events.length === 0) return null;

    const counts: Record<string, number> = {};
    const firstOccurrence: Record<string, string> = {};

    for (const evt of events) {
      counts[evt.event_type] = (counts[evt.event_type] || 0) + 1;
      if (!firstOccurrence[evt.event_type]) {
        firstOccurrence[evt.event_type] = evt.created_at;
      }
    }

    const stages = FUNNEL_STAGES.map(s => ({
      ...s,
      count: counts[s.key] || 0,
      reached: !!firstOccurrence[s.key],
      firstAt: firstOccurrence[s.key] || null,
    }));

    const transitions: { from: string; to: string; duration: number }[] = [];
    for (let i = 0; i < stages.length - 1; i++) {
      const from = stages[i];
      const to = stages[i + 1];
      if (from.firstAt && to.firstAt) {
        const dur = new Date(to.firstAt).getTime() - new Date(from.firstAt).getTime();
        transitions.push({ from: from.label, to: to.label, duration: dur });
      }
    }

    const dropoffIdx = stages.findIndex(s => !s.reached);
    const dropoff = dropoffIdx > 0 ? stages[dropoffIdx].label : null;

    const viewCount = counts["viewed"] || 0;
    const invoiceViews = counts["invoice_viewed"] || 0;

    return { stages, transitions, dropoff, viewCount, invoiceViews, totalEvents: events.length };
  }, [events]);

  if (events.length === 0) {
    return (
      <div style={{ color: MUTED, fontSize: 12, fontFamily: BODY, padding: "12px 0" }}>
        No events recorded yet.
      </div>
    );
  }

  return (
    <div>
      {/* View toggle */}
      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        <button
          onClick={() => setView("funnel")}
          style={{
            padding: "4px 10px", borderRadius: 4, fontSize: 10,
            fontFamily: "var(--font-mono)", letterSpacing: "0.08em",
            textTransform: "uppercase", cursor: "pointer",
            background: view === "funnel" ? "rgba(139,107,62,0.15)" : "transparent",
            color: view === "funnel" ? GOLD : MUTED,
            border: view === "funnel" ? `1px solid rgba(139,107,62,0.3)` : `1px solid ${BORDER}`,
          }}
        >Friction</button>
        <button
          onClick={() => setView("log")}
          style={{
            padding: "4px 10px", borderRadius: 4, fontSize: 10,
            fontFamily: "var(--font-mono)", letterSpacing: "0.08em",
            textTransform: "uppercase", cursor: "pointer",
            background: view === "log" ? "rgba(139,107,62,0.15)" : "transparent",
            color: view === "log" ? GOLD : MUTED,
            border: view === "log" ? `1px solid rgba(139,107,62,0.3)` : `1px solid ${BORDER}`,
          }}
        >Log</button>
      </div>

      {view === "funnel" && analysis ? (
        <div>
          {/* Funnel progress */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
            {analysis.stages.map((stage, i) => {
              const maxCount = Math.max(...analysis.stages.map(s => s.count), 1);
              const barWidth = stage.count > 0 ? Math.max(8, (stage.count / maxCount) * 100) : 0;
              const isDropoff = analysis.dropoff === stage.label;

              return (
                <div key={stage.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 70, fontSize: 10, color: stage.reached ? TEXT : MUTED,
                    fontFamily: "var(--font-mono)", letterSpacing: "0.04em",
                    textAlign: "right", flexShrink: 0, fontWeight: stage.reached ? 600 : 400,
                  }}>{stage.label}</div>

                  <div style={{
                    flex: 1, height: 14, borderRadius: 3,
                    background: SURF_2, overflow: "hidden", position: "relative",
                  }}>
                    {stage.count > 0 && (
                      <div style={{
                        width: `${barWidth}%`, height: "100%", borderRadius: 3,
                        background: isDropoff ? RED : stage.reached ? GREEN : MUTED,
                        opacity: 0.7, transition: "width 400ms ease",
                      }} />
                    )}
                  </div>

                  <div style={{
                    width: 24, fontSize: 11, fontWeight: 700,
                    color: stage.reached ? TEXT : MUTED,
                    fontFamily: "var(--font-mono)", textAlign: "center",
                  }}>{stage.count}</div>

                  {isDropoff && (
                    <span style={{
                      fontSize: 9, color: RED, fontFamily: "var(--font-mono)",
                      fontWeight: 600, letterSpacing: "0.06em",
                    }}>DROP</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Time between stages */}
          {analysis.transitions.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{
                fontSize: 9, color: MUTED, fontFamily: "var(--font-mono)",
                letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6,
              }}>Time Between Stages</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {analysis.transitions.map(t => {
                  const isSlow = t.duration > 24 * 60 * 60 * 1000;
                  return (
                    <div key={`${t.from}-${t.to}`} style={{
                      display: "flex", alignItems: "center", gap: 8,
                      fontSize: 11, fontFamily: "var(--font-mono)",
                    }}>
                      <span style={{ color: MUTED }}>{t.from}</span>
                      <span style={{ color: MUTED, opacity: 0.4 }}>→</span>
                      <span style={{ color: MUTED }}>{t.to}</span>
                      <span style={{
                        marginLeft: "auto",
                        color: isSlow ? RED : GREEN,
                        fontWeight: 600,
                      }}>{fmtDuration(t.duration)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick stats */}
          <div style={{
            display: "flex", gap: 12, paddingTop: 8,
            borderTop: `1px solid ${BORDER}`,
          }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: TEXT, fontFamily: "var(--font-ui)" }}>
                {analysis.viewCount}
              </div>
              <div style={{ fontSize: 9, color: MUTED, fontFamily: "var(--font-mono)", letterSpacing: "0.1em" }}>
                VIEWS
              </div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: TEXT, fontFamily: "var(--font-ui)" }}>
                {analysis.invoiceViews}
              </div>
              <div style={{ fontSize: 9, color: MUTED, fontFamily: "var(--font-mono)", letterSpacing: "0.1em" }}>
                INV VIEWS
              </div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: TEXT, fontFamily: "var(--font-ui)" }}>
                {analysis.totalEvents}
              </div>
              <div style={{ fontSize: 9, color: MUTED, fontFamily: "var(--font-mono)", letterSpacing: "0.1em" }}>
                TOTAL
              </div>
            </div>
          </div>
        </div>
      ) : (
        <LogView events={events} />
      )}
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
              <div style={{
                width: 6, height: 6, borderRadius: "50%",
                background: meta.color, flexShrink: 0, marginTop: 5,
              }} />
              {!isLast && (
                <div style={{ width: 1, flex: 1, background: BORDER, marginTop: 2, minHeight: 10 }} />
              )}
            </div>
            <div style={{ paddingTop: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: TEXT, fontFamily: BODY }}>
                {getEventMeta(evt.event_type).label}
              </div>
              <div style={{ fontSize: 10, color: MUTED, fontFamily: "var(--font-mono)" }}>
                {fmtDateTime(evt.created_at)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
