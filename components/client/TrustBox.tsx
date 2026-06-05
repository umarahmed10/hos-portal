// Credibility + trust bullets — used in portal Documents tab and signing flow.
import { BODY, BORDER, FONT, GREEN, GREEN_DIM, GREEN_BORDER, MUTED, SURF, TEXT } from "@/lib/styles";

const TRUST_BULLETS = [
  { icon: "✓", text: "No setup fees — ever" },
  { icon: "✓", text: "Cancel anytime with 7 days' written notice" },
  { icon: "✓", text: "You only pay for qualified calls" },
  { icon: "✓", text: "Signed copies are automatically emailed to you" },
];

const WHY_HOS = [
  { stat: "10+",   label: "Qualified Calls Minimum" },
  { stat: "48h",   label: "Average Time to First Call" },
  { stat: "2,000+", label: "Phone Leads Delivered" },
];

interface Props {
  showCredibility?: boolean;
  style?: React.CSSProperties;
}

export function TrustBox({ showCredibility = true, style }: Props) {
  return (
    <div style={style}>
      {/* Why HOS credibility row */}
      {showCredibility && (
        <div style={{
          display:       "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap:           1,
          marginBottom:  20,
          background:    BORDER,
          borderRadius:  10,
          overflow:      "hidden",
          border:        `1px solid ${BORDER}`,
        }}>
          {WHY_HOS.map(({ stat, label }) => (
            <div key={stat} style={{
              background:  SURF,
              padding:     "16px 12px",
              textAlign:   "center",
            }}>
              <div style={{
                fontFamily:    "var(--font-header)",
                fontSize:      22,
                fontWeight:    800,
                color:         TEXT,
                letterSpacing: "-0.5px",
                marginBottom:  2,
              }}>
                {stat}
              </div>
              <div style={{ fontSize: 10, color: MUTED, fontFamily: BODY, lineHeight: 1.3 }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Trust bullets */}
      <div style={{
        background:   GREEN_DIM,
        border:       `1px solid ${GREEN_BORDER}`,
        borderRadius: 10,
        padding:      "18px 20px",
      }}>
        <div style={{
          fontSize:      10,
          letterSpacing: "1.5px",
          fontWeight:    700,
          color:         GREEN,
          fontFamily:    BODY,
          marginBottom:  12,
          textTransform: "uppercase",
        }}>
          Your Commitment, Clearly Stated
        </div>
        {TRUST_BULLETS.map(({ icon, text }) => (
          <div key={text} style={{
            display:      "flex",
            alignItems:   "flex-start",
            gap:          10,
            marginBottom: 8,
            fontSize:     13,
            color:        "#a3e4b8",
            lineHeight:   1.5,
            fontFamily:   BODY,
          }}>
            <span style={{ color: GREEN, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{icon}</span>
            <span>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
