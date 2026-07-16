// Two-section credibility block shown on the sign step — stats + reasons to trust.
import { BODY, BORDER, GOLD, MONO, MUTED, SURF, TEXT, UI } from "@/lib/styles";

const STATS = [
  { stat: "10+",    label: "Guaranteed calls" },
  { stat: "48h",    label: "To see results" },
  { stat: "2,000+", label: "Leads delivered" },
  { stat: "100%",   label: "Cancel anytime" },
];

const REASONS = [
  "No long-term contracts — month to month.",
  "Dedicated team monitoring every campaign.",
  "Transparent reporting — see every call, every week.",
  "Built specifically for home service businesses.",
];

export function CredibilitySection() {
  return (
    <div style={{ marginBottom: 18 }}>
      {/* Stats row */}
      <div className="credibility-stats-grid" style={{
        display:             "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap:                 1,
        background:          BORDER,
        borderRadius:        12,
        overflow:            "hidden",
        marginBottom:        14,
      }}>
        {STATS.map(({ stat, label }) => (
          <div key={stat} style={{ background: SURF, padding: "16px 6px", textAlign: "center" }}>
            <div style={{ fontFamily: UI, fontSize: 20, fontWeight: 700, color: TEXT, letterSpacing: "-0.3px", marginBottom: 3, lineHeight: 1 }}>
              {stat}
            </div>
            <div style={{ fontSize: 9, color: MUTED, fontFamily: BODY, lineHeight: 1.3 }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Reasons */}
      <div style={{
        background:   SURF,
        border:       `1px solid ${BORDER}`,
        borderRadius: 10,
        padding:      "16px 20px",
      }}>
        <div style={{ fontSize: 9, letterSpacing: "0.13em", color: GOLD, fontFamily: MONO, fontWeight: 500, textTransform: "uppercase", marginBottom: 12 }}>
          Why businesses choose HOS
        </div>
        {REASONS.map(text => (
          <div key={text} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 7, fontSize: 13, color: MUTED, fontFamily: BODY, lineHeight: 1.5 }}>
            <span style={{ color: GOLD, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>·</span>
            <span>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
