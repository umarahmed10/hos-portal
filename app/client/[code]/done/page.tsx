// Server Component — confirmation page shown immediately after signing.
// Shows confetti, premium welcome hero, social proof, and status tracker.
import { notFound }        from "next/navigation";
import { getDocForClient, getDocEvents } from "@/lib/data-access";
import { DoneCountdown }   from "./DoneCountdown";
import { ConfettiExplosion } from "@/components/client/ConfettiExplosion";
import { StatusTracker }   from "@/components/client/StatusTracker";
import { BODY, BORDER, FONT, GREEN, GREEN_DIM, GREEN_BORDER, MONO, MUTED, SURF, TEXT, css } from "@/lib/styles";
import { fmtDateTime, money } from "@/lib/utils";

interface Props {
  params: Promise<{ code: string }>;
}

const SOCIAL_PROOF = [
  { stat: "10+",    label: "Qualified Calls\nMinimum Guaranteed" },
  { stat: "48h",    label: "Average Time\nto First Call" },
  { stat: "2,000+", label: "Phone Call Leads\nDelivered" },
];

export default async function ClientDonePage({ params }: Props) {
  const { code } = await params;
  const doc      = await getDocForClient(code.toUpperCase());

  if (!doc) notFound();

  // Fetch events for the status tracker (best-effort — empty if fails)
  const events = await getDocEvents(doc.id).catch(() => []);

  return (
    <div style={{ ...css.app, minHeight: "100vh" }}>
      <ConfettiExplosion />

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "48px 24px 80px", textAlign: "center" }}>

        {/* Check circle */}
        <div style={{
          width:       80, height: 80, borderRadius: "50%",
          border:      `2px solid ${GREEN}`,
          background:  GREEN_DIM,
          display:     "flex", alignItems: "center", justifyContent: "center",
          margin:      "0 auto 28px",
          fontSize:    28,
          animation:   "fadeIn 300ms ease-out",
        }}>
          ✓
        </div>

        <div style={{ fontSize: 10, letterSpacing: "2.5px", fontWeight: 800, color: GREEN, fontFamily: BODY, marginBottom: 10 }}>
          SIGNED &amp; CONFIRMED
        </div>

        <h1 style={{ fontFamily: FONT, fontSize: 56, fontWeight: 900, letterSpacing: "-1px", lineHeight: 0.95, color: TEXT, marginBottom: 16 }}>
          WELCOME<br />TO HOS.
        </h1>

        <p style={{ color: MUTED, fontSize: 15, lineHeight: 1.8, marginBottom: 36, maxWidth: 380, margin: "0 auto 36px" }}>
          Your agreement is signed. Our team has been notified and we are setting up your campaign. Expect your first qualified call within 48 hours of campaign launch.
        </p>

        {/* Social proof */}
        <div style={{
          display:   "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap:       1,
          background: BORDER,
          borderRadius: 12,
          overflow:  "hidden",
          border:    `1px solid ${BORDER}`,
          marginBottom: 28,
          animation: "fadeIn 350ms ease-out",
        }}>
          {SOCIAL_PROOF.map(({ stat, label }) => (
            <div key={stat} style={{ background: SURF, padding: "20px 12px", textAlign: "center" }}>
              <div style={{ fontFamily: FONT, fontSize: 26, fontWeight: 900, color: TEXT, letterSpacing: "-0.5px", marginBottom: 4 }}>
                {stat}
              </div>
              <div style={{ fontSize: 10, color: MUTED, fontFamily: BODY, lineHeight: 1.4, whiteSpace: "pre-line" }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Doc summary */}
        <div style={{
          background:   SURF,
          border:       `1px solid ${BORDER}`,
          borderRadius: 10,
          padding:      "18px 20px",
          marginBottom: 20,
          textAlign:    "left",
          animation:    "fadeIn 400ms ease-out",
        }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, fontFamily: FONT, letterSpacing: "0.3px", color: TEXT }}>
            {doc.name}{doc.company ? ` · ${doc.company}` : ""}
          </div>
          {doc.signed_at && (
            <div style={{ fontSize: 12, color: MUTED, marginBottom: 4, fontFamily: BODY }}>
              Signed {fmtDateTime(doc.signed_at)}
            </div>
          )}
          {doc.invoice_total > 0 && (
            <div style={{ fontSize: 12, color: MUTED, fontFamily: BODY }}>
              Invoice total:{" "}
              <span style={{ color: TEXT, fontFamily: MONO }}>{money(doc.invoice_total)}</span>
            </div>
          )}
        </div>

        {/* Status tracker */}
        <div style={{
          background:   SURF,
          border:       `1px solid ${BORDER}`,
          borderRadius: 10,
          padding:      "20px 20px",
          marginBottom: 24,
          textAlign:    "left",
          animation:    "fadeIn 450ms ease-out",
        }}>
          <div style={{ fontSize: 10, letterSpacing: "1.5px", fontWeight: 700, color: MUTED, fontFamily: BODY, marginBottom: 16, textTransform: "uppercase" }}>
            Your Onboarding Progress
          </div>
          <StatusTracker doc={doc} events={events} compact />
        </div>

        {/* Countdown */}
        <DoneCountdown slug={doc.slug} />

        {/* PDF download */}
        <a
          href={`/api/pdf?code=${doc.code}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...css.btnS, display: "inline-block", textDecoration: "none", padding: "11px 28px", fontSize: 13 }}
        >
          Download Signed PDF
        </a>

        {/* Portal link */}
        {doc.slug && (
          <div style={{ marginTop: 16 }}>
            <a
              href={`/portal/${doc.slug}/status`}
              style={{ fontSize: 12, color: MUTED, fontFamily: BODY }}
            >
              Go to your portal →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
