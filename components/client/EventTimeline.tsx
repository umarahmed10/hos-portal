"use client";
// Admin-facing audit trail for a document.
import { fmtDateTime } from "@/lib/utils";
import { BODY, BORDER, GREEN, MUTED, SURF, TEXT } from "@/lib/styles";
import type { DocEvent, DocEventType } from "@/types";

const EVENT_META: Record<DocEventType, { label: string; icon: string; color: string }> = {
  created:         { label: "Document created",          icon: "◎", color: "#555"  },
  email_sent:      { label: "Access email sent",         icon: "✉", color: "#6366f1" },
  viewed:          { label: "Document viewed",           icon: "◈", color: "#f59e0b" },
  signed:          { label: "Agreement signed",          icon: "✓", color: GREEN    },
  invoice_viewed:  { label: "Invoice viewed",            icon: "◈", color: "#f59e0b" },
  payment_updated: { label: "Payment status updated",    icon: "$", color: "#22c55e" },
};

function metaLabel(event: DocEvent): string {
  const m = event.metadata as Record<string, unknown>;
  if (event.event_type === "viewed" && m.via) return `Viewed via ${m.via}`;
  if (event.event_type === "email_sent" && m.to) return `Sent to ${m.to}`;
  return EVENT_META[event.event_type]?.label ?? event.event_type;
}

interface Props {
  events: DocEvent[];
}

export function EventTimeline({ events }: Props) {
  if (events.length === 0) {
    return (
      <div style={{ color: MUTED, fontSize: 12, fontFamily: BODY, padding: "12px 0" }}>
        No events recorded yet.
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      {events.map((evt, i) => {
        const meta   = EVENT_META[evt.event_type] ?? { label: evt.event_type, icon: "·", color: MUTED };
        const isLast = i === events.length - 1;

        return (
          <div key={evt.id} style={{ display: "flex", gap: 12, paddingBottom: isLast ? 0 : 14 }}>
            {/* Icon + line */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 20 }}>
              <div style={{
                width:      20, height: 20,
                borderRadius: "50%",
                border:     `1px solid ${meta.color}`,
                background: `${meta.color}15`,
                display:    "flex", alignItems: "center", justifyContent: "center",
                fontSize:   10, fontWeight: 700, color: meta.color,
                flexShrink: 0,
              }}>
                {meta.icon}
              </div>
              {!isLast && (
                <div style={{ width: 1, flex: 1, background: BORDER, marginTop: 3, minHeight: 12 }} />
              )}
            </div>

            {/* Content */}
            <div style={{ paddingTop: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: TEXT, fontFamily: BODY, marginBottom: 1 }}>
                {metaLabel(evt)}
              </div>
              <div style={{ fontSize: 11, color: MUTED, fontFamily: BODY }}>
                {fmtDateTime(evt.created_at)}
                {evt.ip_address && ` · ${evt.ip_address}`}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
