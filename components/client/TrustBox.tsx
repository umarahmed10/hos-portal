// Trust bullets — bronze-tinted commitment card shown above the signature step
// and on the client document summary.
import { GOLD, GOLD_DIM, GOLD_BORDER, MONO, BODY, TEXT } from "@/lib/styles";

const TRUST_BULLETS = [
  "No setup fees — ever.",
  "Cancel anytime with 7 days written notice.",
  "You only pay for qualified calls that connect.",
  "Signed copies automatically emailed to you.",
  "Your data is encrypted and never shared.",
];

interface Props {
  style?: React.CSSProperties;
}

export function TrustBox({ style }: Props) {
  return (
    <div style={{
      background:   GOLD_DIM,
      border:       `1px solid ${GOLD_BORDER}`,
      borderRadius: 10,
      padding:      "18px 20px",
      ...style,
    }}>
      <div style={{
        fontSize:      9,
        letterSpacing: "0.13em",
        fontWeight:    500,
        color:         GOLD,
        fontFamily:    MONO,
        marginBottom:  12,
        textTransform: "uppercase",
      }}>
        Your Commitment
      </div>
      {TRUST_BULLETS.map(text => (
        <div key={text} style={{
          display:      "flex",
          alignItems:   "flex-start",
          gap:          10,
          marginBottom: 8,
          fontSize:     13,
          color:        TEXT,
          lineHeight:   1.5,
          fontFamily:   BODY,
        }}>
          <span style={{ color: GOLD, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span>
          <span>{text}</span>
        </div>
      ))}
    </div>
  );
}
