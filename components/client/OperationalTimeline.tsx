"use client";
// Client-facing event timeline — shows visible_to_client events on portal status page.
import { BODY, BORDER, MUTED, SURF, TEXT } from "@/lib/styles";
import { fmtRelative } from "@/lib/utils";
import { getEventMeta } from "@/lib/operational-events";
import type { DocEvent } from "@/types";

interface Props {
  events: DocEvent[];
}

export function OperationalTimeline({ events }: Props) {
  if (events.length === 0) {
    return (
      <div style={{
        textAlign:  "center",
        padding:    "28px 20px",
        color:      MUTED,
        fontSize:   13,
        fontFamily: BODY,
        lineHeight: 1.7,
      }}>
        Updates will appear here as your campaign progresses.
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      {events.map((evt, i) => {
        const meta   = getEventMeta(evt.event_type);
        const isLast = i === events.length - 1;

        return (
          <div
            key={evt.id}
            style={{
              display:        "flex",
              gap:            14,
              paddingBottom:  isLast ? 0 : 18,
              animation:      i === 0 ? "slideInLeft 400ms var(--ease-out) both" : "none",
            }}
          >
            {/* Icon + connecting line */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 24 }}>
              <div style={{
                width:          24,
                height:         24,
                borderRadius:   "50%",
                border:         `1px solid ${meta.color}`,
                background:     `${meta.color}18`,
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
                fontSize:       10,
                fontWeight:     700,
                color:          meta.color,
                flexShrink:     0,
                animation:      i === 0 ? "pulseGold 2.5s ease infinite 500ms" : "none",
              }}>
                {meta.icon}
              </div>
              {!isLast && (
                <div style={{ width: 1, flex: 1, background: BORDER, marginTop: 4, minHeight: 14 }} />
              )}
            </div>

            {/* Content */}
            <div style={{ paddingTop: 2, flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: evt.detail ? 4 : 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, fontFamily: BODY }}>
                  {meta.label}
                </div>
                <div style={{ fontSize: 11, color: MUTED, fontFamily: "var(--font-mono)", flexShrink: 0, letterSpacing: "0.04em" }}>
                  {fmtRelative(evt.created_at)}
                </div>
              </div>
              {evt.detail && (
                <div style={{
                  fontSize:     13,
                  color:        MUTED,
                  fontFamily:   BODY,
                  lineHeight:   1.6,
                  background:   SURF,
                  border:       `1px solid ${BORDER}`,
                  borderRadius: 7,
                  padding:      "8px 12px",
                  marginTop:    4,
                }}>
                  {evt.detail}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
