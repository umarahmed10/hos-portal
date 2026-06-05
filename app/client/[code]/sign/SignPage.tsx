"use client";
import { useState }          from "react";
import { useRouter }         from "next/navigation";
import { toast }             from "sonner";
import { SignaturePad }      from "@/components/client/SignaturePad";
import { TrustBox }          from "@/components/client/TrustBox";
import { DocumentPreview }   from "@/components/server/DocumentPreview";
import { InvoiceTable }      from "@/components/server/InvoiceTable";
import { fmt, money }        from "@/lib/utils";
import {
  BODY, FONT, MONO, MUTED, TEXT, SURF, BORDER,
  GREEN, GREEN_DIM, GREEN_BORDER, AMBER, AMBER_DIM, AMBER_BORDER,
  css,
} from "@/lib/styles";
import type { Doc }          from "@/types";

// ── Step definitions ──────────────────────────────────────────────────────────
const STEPS = [
  { n: 1, label: "Agreement"    },
  { n: 2, label: "Invoice"      },
  { n: 3, label: "Sign"         },
  { n: 4, label: "Confirmed"    },
];

// ── Stepper component ─────────────────────────────────────────────────────────
function Stepper({ current }: { current: number }) {
  return (
    <div style={{
      display:        "flex",
      alignItems:     "center",
      gap:            0,
      marginBottom:   40,
      overflowX:      "auto",
    }}>
      {STEPS.map((s, i) => {
        const done   = s.n < current;
        const active = s.n === current;
        return (
          <div key={s.n} style={{ display: "flex", alignItems: "center", flex: s.n < STEPS.length ? 1 : 0 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <div style={{
                width:      28, height: 28,
                borderRadius: "50%",
                border:     `2px solid ${active ? TEXT : done ? GREEN : BORDER}`,
                background: active ? TEXT : done ? GREEN_DIM : "transparent",
                display:    "flex", alignItems: "center", justifyContent: "center",
                transition: "all 200ms ease",
                fontSize:   11, fontWeight: 700,
                color:      active ? "#0a0a0a" : done ? GREEN : MUTED,
              }}>
                {done ? "✓" : s.n}
              </div>
              <div style={{
                fontSize:      10,
                fontWeight:    active ? 700 : 500,
                color:         active ? TEXT : done ? "#3a5c42" : MUTED,
                fontFamily:    BODY,
                whiteSpace:    "nowrap",
                letterSpacing: active ? "0.5px" : 0,
                transition:    "color 200ms ease",
              }}>
                {s.label}
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{
                flex:       1,
                height:     1,
                background: done ? "rgba(34,197,94,0.25)" : BORDER,
                margin:     "-16px 8px 0",
                transition: "background 200ms ease",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function SignPage({ doc }: { doc: Doc }) {
  const router    = useRouter();
  const [step, setStep]             = useState(1);
  const [saving, setSaving]         = useState(false);
  const [accepted, setAccepted]     = useState(false);

  async function handleSign(sigDataUrl: string) {
    if (!accepted) {
      toast.error("Please accept the e-signature terms to continue.");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/sign", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          code:                doc.code,
          signature:           sigDataUrl,
          accepted_esign_terms: accepted,
        }),
      });
      const json = await res.json();

      if (!json.ok) {
        toast.error(json.error || "Signature failed. Please try again.");
        setSaving(false);
        return;
      }

      // Move to confirmation step then redirect
      setStep(4);
      setTimeout(() => {
        router.push(`/client/${doc.code}/done`);
      }, 1800);
    } catch {
      toast.error("Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div style={{ ...css.app, paddingBottom: 80 }}>
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "32px 24px" }}>

        {/* Back */}
        {step < 4 && (
          <button
            onClick={() => step > 1 ? setStep(s => s - 1) : router.push(`/client/${doc.code}`)}
            style={{
              background: "none", border: "none", color: MUTED, cursor: "pointer",
              fontSize: 13, padding: 0, marginBottom: 28, fontFamily: BODY,
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            ← {step === 1 ? "Back to Document" : "Back"}
          </button>
        )}

        {/* Stepper */}
        <Stepper current={step} />

        {/* ── STEP 1: Agreement ────────────────────────────────────────────── */}
        {step === 1 && (
          <div style={{ animation: "fadeIn 180ms ease-out" }}>
            <div style={{ fontSize: 10, letterSpacing: "2.5px", fontWeight: 800, color: MUTED, fontFamily: BODY, marginBottom: 10 }}>
              STEP 1 OF 3
            </div>
            <h2 style={{ fontFamily: FONT, fontSize: 40, fontWeight: 900, letterSpacing: "-0.5px", lineHeight: 1, color: TEXT, marginBottom: 24 }}>
              REVIEW<br />AGREEMENT
            </h2>

            {doc.agreement_text ? (
              <div style={{ ...css.card, maxHeight: 500, overflowY: "auto", marginBottom: 24 }}>
                <div style={{ fontSize: 10, letterSpacing: "2px", fontWeight: 800, color: "#444", fontFamily: BODY, marginBottom: 16 }}>
                  SERVICE AGREEMENT
                </div>
                <div className="doc-text">{doc.agreement_text}</div>
              </div>
            ) : (
              <div style={{ ...css.card, color: MUTED, fontSize: 13, fontFamily: BODY, marginBottom: 24 }}>
                No agreement text for this document.
              </div>
            )}

            <button
              onClick={() => setStep(2)}
              style={{ ...css.btnP, width: "100%", padding: "14px 24px", fontSize: 14 }}
            >
              I'VE READ THE AGREEMENT — CONTINUE →
            </button>
          </div>
        )}

        {/* ── STEP 2: Invoice ──────────────────────────────────────────────── */}
        {step === 2 && (
          <div style={{ animation: "fadeIn 180ms ease-out" }}>
            <div style={{ fontSize: 10, letterSpacing: "2.5px", fontWeight: 800, color: MUTED, fontFamily: BODY, marginBottom: 10 }}>
              STEP 2 OF 3
            </div>
            <h2 style={{ fontFamily: FONT, fontSize: 40, fontWeight: 900, letterSpacing: "-0.5px", lineHeight: 1, color: TEXT, marginBottom: 24 }}>
              REVIEW<br />INVOICE
            </h2>

            <div style={{ ...css.card, marginBottom: 24 }}>
              <InvoiceTable doc={doc} sectionNum="02" />
            </div>

            <button
              onClick={() => setStep(3)}
              style={{ ...css.btnP, width: "100%", padding: "14px 24px", fontSize: 14 }}
            >
              INVOICE CONFIRMED — CONTINUE →
            </button>
          </div>
        )}

        {/* ── STEP 3: Sign ─────────────────────────────────────────────────── */}
        {step === 3 && (
          <div style={{ animation: "fadeIn 180ms ease-out" }}>
            <div style={{ fontSize: 10, letterSpacing: "2.5px", fontWeight: 800, color: MUTED, fontFamily: BODY, marginBottom: 10 }}>
              STEP 3 OF 3
            </div>
            <h2 style={{ fontFamily: FONT, fontSize: 40, fontWeight: 900, letterSpacing: "-0.5px", lineHeight: 1, color: TEXT, marginBottom: 12 }}>
              SIGN THE<br />AGREEMENT
            </h2>

            <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.7, marginBottom: 24 }}>
              By signing, you confirm you have read and agree to the terms of the HOS Automations service agreement. Your signature and timestamp are recorded.
            </p>

            {/* Trust box */}
            <TrustBox showCredibility={false} style={{ marginBottom: 24 }} />

            {/* Signing card */}
            <div style={{ ...css.card, marginBottom: 16 }}>
              <div style={{
                display:        "flex",
                justifyContent: "space-between",
                fontSize:       12,
                color:          MUTED,
                marginBottom:   16,
                flexWrap:       "wrap",
                gap:            8,
              }}>
                <span>
                  Signing as:{" "}
                  <strong style={{ color: TEXT }}>{doc.name}{doc.company ? `, ${doc.company}` : ""}</strong>
                </span>
                <span style={{ fontFamily: MONO }}>{fmt(new Date())}</span>
              </div>

              {saving ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: MUTED, fontSize: 13, fontFamily: BODY }}>
                  <div style={{ fontSize: 24, marginBottom: 12 }}>✓</div>
                  Saving your signature…
                </div>
              ) : (
                <SignaturePad onConfirm={handleSign} accepted={accepted} />
              )}
            </div>

            {/* E-sign consent checkbox */}
            <label style={{
              display:    "flex",
              alignItems: "flex-start",
              gap:        12,
              cursor:     "pointer",
              padding:    "14px 16px",
              background: accepted ? AMBER_DIM : "#0c0c0c",
              border:     `1px solid ${accepted ? AMBER_BORDER : BORDER}`,
              borderRadius: 8,
              marginBottom: 0,
              transition: "all 150ms ease",
            }}>
              <input
                type="checkbox"
                checked={accepted}
                onChange={e => setAccepted(e.target.checked)}
                style={{ marginTop: 2, flexShrink: 0, accentColor: AMBER, width: 16, height: 16 }}
              />
              <span style={{ fontSize: 12, color: accepted ? AMBER : MUTED, lineHeight: 1.6, fontFamily: BODY }}>
                I understand that my electronic signature is legally binding and has the same legal effect as a handwritten signature.
              </span>
            </label>
          </div>
        )}

        {/* ── STEP 4: Confirmed ────────────────────────────────────────────── */}
        {step === 4 && (
          <div style={{ animation: "fadeIn 200ms ease-out", textAlign: "center", paddingTop: 40 }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%",
              border: `2px solid ${GREEN}`,
              background: GREEN_DIM,
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 24px",
              fontSize: 28,
            }}>
              ✓
            </div>
            <div style={{ fontSize: 10, letterSpacing: "2.5px", fontWeight: 800, color: GREEN, fontFamily: BODY, marginBottom: 10 }}>
              SIGNATURE RECORDED
            </div>
            <h2 style={{ fontFamily: FONT, fontSize: 40, fontWeight: 900, letterSpacing: "-0.5px", lineHeight: 1, color: TEXT, marginBottom: 12 }}>
              WELCOME<br />TO HOS.
            </h2>
            <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.7 }}>
              Redirecting you to your confirmation page…
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
