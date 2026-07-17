// Post-signing confirmation page — shown after /client/[code]/sign completes.
import { notFound }        from "next/navigation";
import { getDocForClient, getDocEvents } from "@/lib/data-access";
import { DoneCountdown }      from "./DoneCountdown";
import { ConfettiExplosion }  from "@/components/client/ConfettiExplosion";
import { StatusTracker }      from "@/components/client/StatusTracker";
import { SetupChecklist }     from "@/components/client/SetupChecklist";
import { PortalEnterButton }  from "@/components/client/PortalEnterButton";
import {
  BODY, BORDER, DISPLAY, UI, GREEN, GREEN_DIM,
  MUTED, SURF, TEXT, css, MONO, GOLD,
} from "@/lib/styles";
import { fmtDateTime, money } from "@/lib/utils";

interface Props {
  params: Promise<{ code: string }>;
}

const SOCIAL_PROOF = [
  { stat: "10+",    label: "Minimum Guaranteed\nCalls" },
  { stat: "48h",    label: "Time to\nSee Results" },
  { stat: "2,000+", label: "Phone Call Leads\nGenerated" },
];

const NEXT_STEPS = [
  { when: "Within 24 hours", what: "Account provisioning complete" },
  { when: "Within 48 hours", what: "Campaign queue activated" },
  { when: "3–7 days",        what: "Qualified calls begin" },
  { when: "Every Monday",    what: "Performance report delivered" },
];

export default async function ClientDonePage({ params }: Props) {
  const { code } = await params;
  const doc      = await getDocForClient(code.toUpperCase());

  if (!doc) notFound();

  const events = await getDocEvents(doc.id).catch(() => []);

  return (
    <div style={{ ...css.app, minHeight: "100vh" }}>
      <ConfettiExplosion />

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "52px 20px 100px", textAlign: "center" }}>

        {/* Check circle */}
        <div style={{
          width:          72,
          height:         72,
          borderRadius:   "50%",
          border:         `2px solid ${GREEN}`,
          background:     GREEN_DIM,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          margin:         "0 auto 24px",
          fontSize:       28,
          color:          GREEN,
          animation:      "scalePop 500ms var(--ease-spring) both",
        }}>
          ✓
        </div>

        {/* Label */}
        <div style={{
          fontSize:      10,
          letterSpacing: "2px",
          fontWeight:    700,
          color:         GOLD,
          fontFamily:    MONO,
          marginBottom:  14,
          textTransform: "uppercase",
          animation:     "fadeUp 400ms var(--ease-out) 200ms both",
        }}>
          Agreement Executed{doc.signed_at ? ` · ${fmtDateTime(doc.signed_at)}` : ""}
        </div>

        {/* Hero */}
        <h1 style={{
          fontFamily:    DISPLAY,
          fontStyle:     "italic",
          fontSize:      "clamp(52px, 8vw, 84px)",
          fontWeight:    300,
          letterSpacing: "-0.02em",
          lineHeight:    0.95,
          color:         TEXT,
          marginBottom:  10,
          animation:     "fadeUp 500ms var(--ease-out) 350ms both",
        }}>
          You&apos;re in.
        </h1>

        <p style={{
          color:        MUTED,
          fontFamily:   BODY,
          fontSize:     15,
          lineHeight:   1.7,
          marginBottom: 36,
          animation:    "fadeUp 400ms var(--ease-out) 500ms both",
        }}>
          Welcome to House Of Sales.
        </p>

        {/* Animated checklist */}
        <div style={{
          textAlign:    "left",
          marginBottom: 24,
          background:   SURF,
          border:       `1px solid ${BORDER}`,
          borderRadius: 12,
          padding:      "20px 22px",
          animation:    "fadeUp 400ms var(--ease-out) 650ms both",
        }}>
          <div style={{ fontSize: 10, letterSpacing: "1px", color: MUTED, fontFamily: MONO, fontWeight: 700, marginBottom: 14, textTransform: "uppercase" }}>
            What&apos;s happening now
          </div>
          <SetupChecklist />
        </div>

        {/* What happens next */}
        <div style={{
          textAlign:    "left",
          marginBottom: 24,
          background:   SURF,
          border:       `1px solid ${BORDER}`,
          borderRadius: 12,
          padding:      "20px 22px",
          animation:    "fadeUp 400ms var(--ease-out) 1200ms both",
        }}>
          <div style={{ fontSize: 10, letterSpacing: "1px", color: MUTED, fontFamily: MONO, fontWeight: 700, marginBottom: 14, textTransform: "uppercase" }}>
            What happens next
          </div>
          {NEXT_STEPS.map(({ when, what }, i) => (
            <div key={what} style={{
              display:        "flex",
              alignItems:     "baseline",
              gap:            10,
              padding:        "7px 0",
              borderBottom:   i < NEXT_STEPS.length - 1 ? `1px solid ${BORDER}` : "none",
              animation:      "slideInRight 350ms var(--ease-out) both",
              animationDelay: `${1250 + i * 80}ms`,
            }}>
              <span style={{ color: GOLD, fontFamily: MONO, fontSize: 13 }}>→</span>
              <span style={{ fontFamily: BODY, fontSize: 14, fontWeight: 600, color: TEXT }}>
                {what}
              </span>
              <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 11, color: MUTED, letterSpacing: "0.04em" }}>
                {when}
              </span>
            </div>
          ))}
        </div>

        {/* Portal CTA — primary action after signing */}
        {doc.slug && (
          <div style={{ marginBottom: 24, animation: "scaleIn 400ms var(--ease-spring) 1600ms both" }}>
            <PortalEnterButton slug={doc.slug} code={doc.code} />
          </div>
        )}

        {/* Social proof */}
        <div className="social-proof-grid" style={{
          display:             "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap:                 1,
          background:          BORDER,
          borderRadius:        12,
          overflow:            "hidden",
          marginBottom:        24,
          animation:           "fadeUp 400ms var(--ease-out) 1900ms both",
        }}>
          {SOCIAL_PROOF.map(({ stat, label }) => (
            <div key={stat} style={{ background: SURF, padding: "18px 10px", textAlign: "center" }}>
              <div style={{ fontFamily: UI, fontSize: 26, fontWeight: 700, color: TEXT, letterSpacing: "-0.5px", marginBottom: 4, lineHeight: 1 }}>
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
          padding:      "16px 20px",
          marginBottom: 16,
          textAlign:    "left",
          animation:    "fadeIn 650ms var(--ease-out)",
        }}>
          <div style={{ fontFamily: BODY, fontSize: 14, fontWeight: 700, color: TEXT, marginBottom: 5 }}>
            {doc.name}{doc.company ? ` · ${doc.company}` : ""}
          </div>
          {doc.signed_at && (
            <div style={{ fontSize: 12, color: MUTED, marginBottom: 3, fontFamily: BODY }}>
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
          padding:      "20px 20px 16px",
          marginBottom: 14,
          textAlign:    "left",
          animation:    "fadeIn 700ms var(--ease-out)",
        }}>
          <div style={{ fontSize: 10, letterSpacing: "1px", fontWeight: 700, color: MUTED, fontFamily: BODY, marginBottom: 16 }}>
            Your onboarding progress
          </div>
          <StatusTracker doc={doc} events={events} compact />
        </div>

        <DoneCountdown slug={doc.slug} code={doc.code} />

        {/* PDF */}
        <div style={{ marginTop: 24 }}>
          <a
            href={`/api/pdf?code=${doc.code}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12, color: MUTED, fontFamily: BODY, textDecoration: "none", opacity: 0.5 }}
          >
            Download signed copy (PDF) ↗
          </a>
        </div>

        <p style={{ fontSize: 12, color: MUTED, textAlign: "center", marginTop: 16, fontFamily: BODY, opacity: 0.5 }}>
          Questions?{" "}
          <a href="mailto:team@hosautomations.co" style={{ color: MUTED, textDecoration: "underline", textDecorationColor: "rgba(114,114,114,0.3)" }}>
            team@hosautomations.co
          </a>
        </p>
      </div>
    </div>
  );
}
