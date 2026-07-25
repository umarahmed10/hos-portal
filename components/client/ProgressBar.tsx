// Linear progress indicator for the multi-step sign flow.
// Bronze fill bar with step dots + labels beneath.
import { BODY, BORDER, GOLD, GREEN, SUBTLE, TEXT } from "@/lib/styles";

interface Props {
  current: number;
  total:   number;
  labels:  string[];
}

export function ProgressBar({ current, total, labels }: Props) {
  if (current > total) return null;
  const pct = ((current - 1) / (total - 1)) * 100;

  return (
    <div style={{ marginBottom: 36 }}>
      {/* Track */}
      <div style={{ position: "relative", height: 3, background: BORDER, borderRadius: 2, marginBottom: 14 }}>
        <div style={{
          position:     "absolute",
          inset:        "0 auto 0 0",
          width:        `${pct}%`,
          background:   `linear-gradient(90deg, rgba(139,107,62,0.6) 0%, #8B6B3E 100%)`,
          borderRadius: 2,
          transition:   "width 500ms var(--ease-out)",
          boxShadow:    "0 0 8px rgba(139,107,62,0.4)",
        }} />
      </div>

      {/* Dots + labels */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {labels.map((label, i) => {
          const n      = i + 1;
          const done   = n < current;
          const active = n === current;
          return (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{
                width:          active ? 9 : 7,
                height:         active ? 9 : 7,
                borderRadius:   "50%",
                background:     done ? GREEN : active ? GOLD : SUBTLE,
                transition:     "background 280ms ease, width 300ms var(--ease-spring), height 300ms var(--ease-spring)",
                flexShrink:     0,
                animation:      active ? "pulseGold 2s infinite" : "none",
              }} />
              <span className="sign-stepper-label" style={{
                fontSize:      10,
                fontWeight:    active ? 700 : 500,
                color:         active ? TEXT : done ? GOLD : SUBTLE,
                fontFamily:    BODY,
                letterSpacing: "0.4px",
                whiteSpace:    "nowrap",
                transition:    "color 280ms ease",
              }}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
