// The "daily read" — a system-generated intelligence briefing at the top of the
// dashboard. Makes the portal feel like it thinks. Server component; content
// comes from lib/insights (real metrics only).
import type { DailyRead } from "@/lib/insights";
import { TEXT, MUTED, GOLD, GREEN } from "@/lib/styles";

export function InsightStrip({ read, title }: { read: DailyRead; title: string }) {
  if (read.insights.length === 0) return null;
  const statusColor = read.status?.tone === "green" ? GREEN : GOLD;

  return (
    <div style={{
      position: "relative",
      background: "linear-gradient(180deg, rgba(139,107,62,0.07), rgba(139,107,62,0.02))",
      border: "1px solid rgba(139,107,62,0.2)",
      borderRadius: 12, padding: "18px 20px 16px", marginBottom: 16,
      overflow: "hidden",
    }}>
      {/* subtle bronze glow, top-right */}
      <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,107,62,0.12), transparent 70%)", pointerEvents: "none" }} />

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l1.9 4.9L19 9l-4.1 1.1L12 15l-2-4.9L6 9l4.1-1.1z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
        </svg>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: GOLD }}>
          {title}
        </span>
        {read.status && (
          <span style={{
            marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5,
            fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase",
            color: statusColor, background: read.status.tone === "green" ? "rgba(78,173,135,0.1)" : "rgba(139,107,62,0.1)",
            border: `1px solid ${read.status.tone === "green" ? "rgba(78,173,135,0.3)" : "rgba(139,107,62,0.3)"}`,
            padding: "3px 9px", borderRadius: 20, fontWeight: 600,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: statusColor }} />
            {read.status.label}
          </span>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {read.insights.map((line, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: i === 0 ? GOLD : "rgba(139,107,62,0.4)", marginTop: 7, flexShrink: 0 }} />
            <span style={{
              fontFamily: "var(--font-body)", fontSize: i === 0 ? 15 : 13.5,
              lineHeight: 1.55, color: i === 0 ? TEXT : MUTED, fontWeight: i === 0 ? 500 : 400,
            }}>
              {line}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
